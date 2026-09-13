import time
import win32gui
import win32con
from pynput import mouse

TRIPLE_CLICK_THRESHOLD_S = 0.120

class TripleClickDetector:
    def __init__(self, threshold_s=TRIPLE_CLICK_THRESHOLD_S):
        self.threshold_s = threshold_s
        self.first_click_time = 0.0
        self.click_count = 0

    def register_click(self, current_time):
        if self.click_count == 0 or (current_time - self.first_click_time > self.threshold_s):
            self.click_count = 1
            self.first_click_time = current_time
            return False
        else:
            self.click_count += 1

        if self.click_count >= 3:
            self.click_count = 0
            self.first_click_time = 0.0
            return True
        return False

detector = TripleClickDetector()

def minimize_active_window():
    hwnd = win32gui.GetForegroundWindow()
    if hwnd:
        win32gui.ShowWindow(hwnd, win32con.SW_MINIMIZE)

def on_click(x, y, button, pressed):
    if pressed and button == mouse.Button.left:
        now = time.perf_counter()
        if detector.register_click(now):
            minimize_active_window()

def main():
    with mouse.Listener(on_click=on_click) as listener:
        listener.join()

if __name__ == '__main__':
    main()
