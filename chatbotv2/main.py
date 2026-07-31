import subprocess
import time

scripts = ["server_llm.py", "server_riot.py", "server_tts.py"]
processes = []

try:
    # Start all background servers
    for script in scripts:
        p = subprocess.Popen(["uv", "run", script])
        processes.append(p)
        print(f"Started {script} (PID: {p.pid})")

    # Keep the main script alive and monitor the servers
    while True:
        for p in processes:
            if p.poll() is not None:
                print(f"Warning: A server stopped with exit code {p.returncode}")
        time.sleep(1)

except KeyboardInterrupt:
    print("\nStopping all servers...")

finally:
    # This guarantees all servers are killed when you press Ctrl+C
    for p in processes:
        if p.poll() is None:  # If still running
            p.terminate()     # Send SIGTERM
            
    print("All servers stopped.")
