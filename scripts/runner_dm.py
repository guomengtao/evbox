#!/usr/bin/env python3
# runner_dm.py - Run node DM test and capture output to file
import subprocess, os, sys

cwd = "/Users/Banner/Documents/guomengtao/ev/evbox/scripts"
out_log = "/Users/Banner/Documents/guomengtao/ev/evbox/scripts/dm_run_result.log"

proc = subprocess.run(
    ["node", "run_bandbbs_dm.js"],
    cwd=cwd,
    capture_output=True,
    text=True,
    timeout=120,
)

with open(out_log, "w") as f:
    f.write("EXIT=" + str(proc.returncode) + "\n")
    f.write("STDOUT:\n" + proc.stdout + "\n")
    f.write("STDERR:\n" + proc.stderr + "\n")

print("WROTE", out_log, "exit", proc.returncode)