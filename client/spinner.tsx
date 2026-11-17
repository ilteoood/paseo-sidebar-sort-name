import { Animated } from "react-native";
import { useEffect, useRef, type ReactElement } from "react";
import { Icon } from "@getpaseo/plugin/client/ui";
import { spinnerStyle } from "./sidebar-styles";

const SPIN_PERIOD_MS = 1100;

export function Spinner({ size, color }: { size: number; color: string }): ReactElement {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let rafId = 0;
    let start: number | null = null;
    const tick = (now: number): void => {
      if (start === null) start = now;
      const phase = ((now - start) % SPIN_PERIOD_MS) / SPIN_PERIOD_MS;
      rotation.setValue(phase);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [rotation]);
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  return (
    <Animated.View style={spinnerStyle(spin)}>
      <Icon name="LoaderCircle" size={size} color={color} />
    </Animated.View>
  );
}
