# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Host-wide lock that serializes `mtt node` commands on one node directory.

Every command that changes a node takes an exclusive `flock` on
`<baseDir>/.lock`: the lifecycle pipelines in `node_state`, and `init` / `join`
while they reset the node directory in `node_provision`. Keeping the primitive
here gives both one implementation, without either depending on the other.

`status` changes nothing, but it reads several things one after another. It
holds the lock shared while it reads (`Shared`), so that no command runs in
between and what it reports is one state of the node. Several `status` calls
can hold it at once.

The lock is kernel-managed: it is released when the holding process exits or
crashes, so there is no stale lock to clean up. The descriptor is opened
non-inheritable, so child processes such as `mtt -vv start` do not keep it.
The holding command is not stored in the lock; it is read from `journal.json`,
which the holder writes after taking the lock.
"""

import contextlib
import errno
import fcntl
import json
import os
import stat
import time
from typing import Iterator, Optional
from multitest_transport.cli import node_permissions

LOCK_FILENAME = ".lock"
# The journal of the most recent pipeline run. Its `command` names the holder
# of the lock while that run is in progress.
JOURNAL_FILENAME = "journal.json"

# How long an acquisition waits for a `status` that holds the lock shared
# while it asks Docker about the containers, and the pause between attempts.
# A command that holds the lock is not waited for at all.
_LOCK_GRACE_SEC = 15.0
_LOCK_RETRY_SEC = 0.05


def Acquire(base_dir: str) -> Optional[int]:
  """Acquires the exclusive lock of a node directory, or reports it held.

  When another command holds the lock, that is reported at once. When only a
  `status` holds it, shared, the non-blocking attempt is retried for
  _LOCK_GRACE_SEC, so that a concurrent `status` cannot make a command fail
  as busy.

  Args:
    base_dir: Node directory; created if missing.

  Returns:
    The locked file descriptor, or None if another process holds the lock.
  """
  os.makedirs(base_dir, exist_ok=True)
  fd = os.open(
      os.path.join(base_dir, LOCK_FILENAME),
      os.O_CREAT | os.O_RDWR,
      node_permissions.BASE_FILE_MODE,
  )
  deadline = time.monotonic() + _LOCK_GRACE_SEC
  while True:
    try:
      fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
      break
    except OSError as e:
      if e.errno not in (errno.EACCES, errno.EAGAIN):
        os.close(fd)
        raise
      if _HeldByCommand(fd) or time.monotonic() >= deadline:
        os.close(fd)
        return None
      time.sleep(_LOCK_RETRY_SEC)
  try:
    st = os.fstat(fd)
    if stat.S_IMODE(st.st_mode) != node_permissions.BASE_FILE_MODE:
      os.fchmod(fd, node_permissions.BASE_FILE_MODE)
  except PermissionError:
    pass
  return fd


def _HeldByCommand(fd: int) -> bool:
  """Tells a command that holds the lock from a `status` that holds it shared.

  Called when the exclusive attempt on fd was refused. A shared attempt is
  refused as well only if the holder has the lock exclusively: a command.

  Args:
    fd: Descriptor of the lock file, holding no lock.

  Returns:
    True if a command holds the lock; False if only `status` calls do.
  """
  try:
    fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
  except OSError as e:
    if e.errno in (errno.EACCES, errno.EAGAIN):
      return True
    raise
  fcntl.flock(fd, fcntl.LOCK_UN)
  return False


def Release(fd: int) -> None:
  """Releases and closes a descriptor returned by Acquire."""
  try:
    fcntl.flock(fd, fcntl.LOCK_UN)
  finally:
    os.close(fd)


@contextlib.contextmanager
def Shared(base_dir: str) -> Iterator[bool]:
  """Holds the lock shared while the caller observes the node.

  Commands take the lock exclusively. While this holds it shared, no command
  is running and none can start, so what the caller reads inside the block is
  one state of the node, never a mix of before and after a command. A command
  that starts meanwhile waits for the block to end (see Acquire).

  The attempt never waits, and creates nothing. A node directory that has no
  lock file yet, or one the caller may not open, is reported free and nothing
  is held.

  Args:
    base_dir: Node directory.

  Yields:
    True if no command holds the lock. False if one does: nothing is held
    then, and what the caller reads may be changing under it.
  """
  try:
    fd = os.open(os.path.join(base_dir, LOCK_FILENAME), os.O_RDONLY)
  except OSError:
    fd = None
  if fd is None:
    yield True
    return
  try:
    free = True
    try:
      fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
    except OSError as e:
      free = e.errno not in (errno.EACCES, errno.EAGAIN)
    yield free
  finally:
    os.close(fd)  # Closing the descriptor releases the lock.


def IsHeld(base_dir: str) -> bool:
  """Tests whether a command holds the lock, creating nothing.

  Args:
    base_dir: Node directory.

  Returns:
    True if the lock file exists and a command holds it.
  """
  with Shared(base_dir) as free:
    return not free


def HolderCommand(base_dir: str) -> str:
  """Names the command that holds the lock, from `journal.json`.

  Only meaningful while the lock is held: the holder writes the journal after
  taking the lock, so a held lock with no readable journal is reported as
  `unknown`.

  Args:
    base_dir: Node directory.

  Returns:
    The journal's `command`, or "unknown".
  """
  try:
    with open(
        os.path.join(base_dir, JOURNAL_FILENAME), "r", encoding="utf-8"
    ) as f:
      data = json.load(f)
  except (OSError, ValueError):
    return "unknown"
  if not isinstance(data, dict):
    return "unknown"
  return str(data.get("command") or "unknown")
