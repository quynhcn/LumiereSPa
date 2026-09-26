"""Kill whatever process listens on the given TCP port (no ss/lsof in this sandbox)."""
import os, signal, sys

port = int(sys.argv[1])
inodes = set()
for f in [x for x in ('/proc/net/tcp', '/proc/net/tcp6') if os.path.exists(x)]:
    for line in open(f).readlines()[1:]:
        parts = line.split()
        if int(parts[1].split(':')[1], 16) == port and parts[3] == '0A':
            inodes.add(parts[9])
for pid in filter(str.isdigit, os.listdir('/proc')):
    try:
        for fd in os.listdir(f'/proc/{pid}/fd'):
            link = os.readlink(f'/proc/{pid}/fd/{fd}')
            if link.startswith('socket:[') and link[8:-1] in inodes:
                os.kill(int(pid), signal.SIGTERM)
                print('killed', pid)
                break
    except (PermissionError, FileNotFoundError, ProcessLookupError):
        pass
