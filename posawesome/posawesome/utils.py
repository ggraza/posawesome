# posawesome/posawesome/posawesome/utils.py

import subprocess
import os

def install_assets():
    """
    Automatically install npm dependencies (vuetify + mdi) after app installation
    """
    app_path = os.path.join(os.path.dirname(__file__))
    print("Installing npm dependencies for POS G2Virtu...")

    try:
        subprocess.check_call(["npm", "install"], cwd=app_path)
        print("npm dependencies installed successfully.")
    except Exception as e:
        print("Error installing npm dependencies:", e)
