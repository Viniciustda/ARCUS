#!/usr/bin/env python3
"""build_replay_data.py: convert the traces of one ns-3 run into the compact files the 3D replay reads.

Author: Vinicius Trindade
Date:   Nov 19, 2026

    ./tools/build_replay_data.py <run folder> [output folder, default data]

Reads nodes.csv, positions.csv, tx.csv, forgeries.csv and blocks.csv (plain or gzipped) and writes:
    meta.json      nodes, attacker, duration, radio range, mobility bounds, blocks and the message count
    positions.bin  Int16 positions in decimetres, [second][node][x, y, z], little endian
    messages.bin   every transmission sorted by time, as four arrays one after the other:
                   Uint32 time in ms, Uint8 sender, Uint8 receiver (255 for a broadcast), Uint8 forged flag
"""

import csv
import gzip
import json
import os
import struct
import sys

# Receiver code of a message sent to every neighbour
BROADCAST = 255
DECIMETRES_PER_METRE = 10
NS_PER_MS = 1_000_000
NS_PER_S = 1_000_000_000


def rows(folder, name):
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Reads one trace, from name.csv or name.csv.gz.

    @param folder - run folder
    @param name - trace name, without extension
    @return the rows as dictionaries
    """
    path = os.path.join(folder, f'{name}.csv')
    handle = open(path, newline='') if os.path.exists(path) else gzip.open(path + '.gz', 'rt', newline='')
    with handle:
        yield from csv.DictReader(handle)


def config_value(folder, key):
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Reads one value of the run's config.txt.

    @param folder - run folder
    @param key - name of the setting
    @return the value, as text
    """
    with open(os.path.join(folder, 'config.txt')) as handle:
        for line in handle:
            name, _, value = line.strip().partition('=')
            if name == key:
                return value
    raise KeyError(key)


def node_addresses(folder):
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Reads the nodes of the run.

    @param folder - run folder
    @return the node count, the attacker id and the node id of each IPv4 address
    """
    by_address, attacker = {}, None
    for row in rows(folder, 'nodes'):
        node = int(row['node_id'])
        by_address[row['ipv4_address']] = node
        if row['is_attacker'] == '1':
            attacker = node
    return len(by_address), attacker, by_address


def positions(folder, count, seconds):
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Packs one position per node and second, from 0 to the duration.

    @param folder - run folder
    @param count - number of nodes
    @param seconds - duration of the run in seconds
    @return the positions as Int16 decimetres

    @note A second with no sample repeats the last known position of the node.
    """
    grid = [[None] * count for _ in range(seconds + 1)]
    for row in rows(folder, 'positions'):
        second = int(row['time_ns']) // NS_PER_S
        if second <= seconds:
            grid[second][int(row['node_id'])] = tuple(round(float(row[axis]) * DECIMETRES_PER_METRE)
                                                      for axis in ('x_m', 'y_m', 'z_m'))
    for second in range(1, seconds + 1):
        for node in range(count):
            if grid[second][node] is None:
                grid[second][node] = grid[second - 1][node]
    flat = [value for frame in grid for node in frame for value in node]
    return struct.pack(f'<{len(flat)}h', *flat)


def messages(folder, attacker, by_address):
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Gathers the honest transmissions and the forgeries.

    @param folder - run folder
    @param attacker - attacker id
    @param by_address - node id of each IPv4 address
    @return the messages as (time ms, sender, receiver, forged), sorted by time
    """
    found = []
    for row in rows(folder, 'tx'):
        destination = int(row['destination_id'])
        found.append((int(row['time_ns']) // NS_PER_MS, int(row['sender_id']),
                      BROADCAST if destination < 0 else destination, 0))
    # A forgery leaves the attacker's radio, whatever identity it claims
    for row in rows(folder, 'forgeries'):
        receiver = by_address.get(row['receiver_address'], BROADCAST)
        found.append((int(row['time_ns']) // NS_PER_MS, attacker, receiver, 1))
    found.sort()
    return found


def pack_messages(found):
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Packs the messages as four arrays one after the other, so each array stays aligned.

    @param found - messages as (time ms, sender, receiver, forged)
    @return the packed bytes
    """
    count = len(found)
    return (struct.pack(f'<{count}I', *(m[0] for m in found)) + bytes(m[1] for m in found)
            + bytes(m[2] for m in found) + bytes(m[3] for m in found))


def blocks(folder, attacker):
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Finds when each node first blocked the attacker.

    @param folder - run folder
    @param attacker - attacker id
    @return the blocks as [time ms, node], sorted by time
    """
    first = {}
    for row in rows(folder, 'blocks'):
        node, time_ms = int(row['receiver_id']), int(row['time_ns']) // NS_PER_MS
        if int(row['blocked_id']) == attacker and (node not in first or time_ms < first[node]):
            first[node] = time_ms
    return sorted([time_ms, node] for node, time_ms in first.items())


def main():
    """
    @author Vinicius Trindade
    @date Nov 19, 2026

    @brief Writes meta.json, positions.bin and messages.bin for the run given.
    """
    folder = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'data'
    os.makedirs(out, exist_ok=True)
    count, attacker, by_address = node_addresses(folder)
    seconds = int(float(config_value(folder, 'duration_s')))
    with open(os.path.join(out, 'positions.bin'), 'wb') as handle:
        handle.write(positions(folder, count, seconds))
    found = messages(folder, attacker, by_address)
    with open(os.path.join(out, 'messages.bin'), 'wb') as handle:
        handle.write(pack_messages(found))
    bounds = [float(v) for v in config_value(folder, 'mobility_bounds_m').split(',')]
    meta = {'nodes': count, 'attacker': attacker, 'duration_s': seconds,
            'range_m': float(config_value(folder, 'provider_distance_threshold_m')),
            'bounds_m': bounds, 'message_count': len(found), 'blocks': blocks(folder, attacker)}
    with open(os.path.join(out, 'meta.json'), 'w') as handle:
        json.dump(meta, handle)


if __name__ == '__main__':
    main()
