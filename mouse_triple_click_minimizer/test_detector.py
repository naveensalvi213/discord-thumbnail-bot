import time
import unittest

class TripleClickDetector:
    def __init__(self, threshold_ms=120):
        self.threshold_s = threshold_ms / 1000.0
        self.first_click_time = 0.0
        self.click_count = 0

    def register_click(self, current_time=None):
        if current_time is None:
            current_time = time.perf_counter()

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

class TestTripleClickDetector(unittest.TestCase):
    def test_rapid_triple_click_triggers(self):
        detector = TripleClickDetector(threshold_ms=120)
        now = 100.0
        self.assertFalse(detector.register_click(now))
        self.assertFalse(detector.register_click(now + 0.03))
        self.assertTrue(detector.register_click(now + 0.07))

    def test_slow_clicks_do_not_trigger(self):
        detector = TripleClickDetector(threshold_ms=120)
        now = 100.0
        self.assertFalse(detector.register_click(now))
        self.assertFalse(detector.register_click(now + 0.20))
        self.assertFalse(detector.register_click(now + 0.40))

if __name__ == '__main__':
    unittest.main()
