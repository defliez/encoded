import React, { useEffect, useState } from "react";
import { Text } from "react-native";

export default function TypewriterText({
    content,
    speed = 40,
    style,
    onTypingComplete,
}) {
    const [displayed, setDisplayed] = useState('');

    useEffect(() => {
        let idx = 0;
        setDisplayed('');
        const ticker = setInterval(() => {
            idx++;
            setDisplayed(content.slice(0, idx));
            if (idx >= content.length) {
                clearInterval(ticker);
                typeof onTypingComplete === 'function' && onTypingComplete();
            }
        }, speed);

        return () => clearInterval(ticker);
    }, [content, speed]);

    return <Text style={style}>{displayed}</Text>;
}
