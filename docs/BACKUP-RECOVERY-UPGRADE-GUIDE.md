# Backup, Recovery and Upgrade Guide

Normal saves should write to a temporary file, synchronize it, verify it and atomically replace the destination. Existing projects receive a backup before schema migration.

Autosave recovery records are checksum-associated with the document ID and retained in a bounded history. A damaged project should never silently replace the current score. Future-version projects should remain read-only until opened by a compatible application.

Before upgrading:
1. Save and close all projects.
2. Keep the most recent `.airscore` backup and recovery files.
3. Install the newer version without deleting user data.
4. Open a copy of an important project first.
5. Confirm playback, linked parts, Sol-fa and publication output.
