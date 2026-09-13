#Requires AutoHotkey v2.0
#SingleInstance Force

; Threshold in milliseconds for triple click detection
TRIPLE_CLICK_THRESHOLD := 120

~LButton:: {
    static clickCount := 0
    static firstClickTime := 0

    currentTime := A_TickCount

    if (clickCount == 0 || (currentTime - firstClickTime > TRIPLE_CLICK_THRESHOLD)) {
        clickCount := 1
        firstClickTime := currentTime
    } else {
        clickCount++
    }

    if (clickCount >= 3) {
        clickCount := 0
        firstClickTime := 0
        WinMinimize("A")
    }
}
