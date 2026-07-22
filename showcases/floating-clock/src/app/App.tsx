import { useState, useEffect, useCallback } from "@lynx-js/react";
import { CustomTitleBar } from "./components/CustomTitleBar";
import "@lynxtron-examples/config/tokens.css";
import "./App.css";

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// Uppercase must be literal in the string — text-transform is dropped at compile.
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  return `${DAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${day}`;
}


export function App() {
  const [time, setTime] = useState(formatTime(new Date()));
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClose = useCallback(() => {
    // @ts-ignore
    NativeModules.bridge.call("close", {}, () => {});
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <view
      className={`app-container`}
      bindmouseenter={handleMouseEnter}
      bindmouseleave={handleMouseLeave}
    >
      <CustomTitleBar
        onClose={handleClose}
        visible={isHovered}
      />
      <view className="clock-container">
        <text className="clock-text">{time}</text>
        <text className="clock-date">{formatDate(new Date())}</text>
      </view>
    </view>
  );
}
