import { useState, useEffect, useCallback } from "@lynx-js/react";
import { CustomTitleBar } from "./components/CustomTitleBar";
import "./App.css";

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
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
      </view>
    </view>
  );
}
