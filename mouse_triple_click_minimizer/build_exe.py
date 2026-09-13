import subprocess
import sys
import os

def build():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_pyw = os.path.join(script_dir, "mouse_minimizer.pyw")
    dist_dir = os.path.join(script_dir, "dist")
    work_dir = os.path.join(script_dir, "build")

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=MouseMinimizer",
        f"--distpath={dist_dir}",
        f"--workpath={work_dir}",
        source_pyw
    ]
    print(f"Building executable with command: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    print("Build successful!")

if __name__ == "__main__":
    build()
