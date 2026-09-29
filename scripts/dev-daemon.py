#!/usr/bin/env python3
"""Start the Next.js dev server fully detached from the invoking shell.

macOS has no setsid(1), so `nohup ... &` leaves the process in the calling
shell's session and it gets torn down when that session's process group is
cleaned up. This does the double fork + os.setsid() properly: the child
leaves the terminal's process group and adopts PID 1 as its parent, which is
the same shape as the backend process (`node server.js`, PPID 1).

Usage: python3 scripts/dev-daemon.py [logfile]
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".logs", "frontend.log")

os.makedirs(os.path.dirname(LOG), exist_ok=True)

# First fork: parent exits immediately so the shell sees a clean exit.
if os.fork() > 0:
    print("dev server detached; log: %s" % LOG)
    sys.exit(0)

os.setsid()  # new session, detached from the controlling terminal

# Second fork: guarantees the final child is not a session leader, so it can
# never reacquire a TTY.
if os.fork() > 0:
    os._exit(0)

log = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
devnull = os.open(os.devnull, os.O_RDONLY)
os.dup2(devnull, 0)
os.dup2(log, 1)
os.dup2(log, 2)

os.chdir(ROOT)
os.execvp("npm", ["npm", "run", "dev"])
