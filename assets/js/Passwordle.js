// Passwordle: Wordle-style password challenge with mobile/tablet keyboard focus on press
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useCallback, useEffect, useRef, startTransition } from "react";
import { addPropertyControls, controlType, RenderTarget, useIsStaticRenderer } from "framer";
import { motion } from "framer-motion";

const defaultWord = "APPLE";
const defaultRedirect = "https://framer.com/";
const defaultColors = {
    correct: "#6aaa64",
    present: "#c9b458",
    absent: "#787c7e",
    empty: "#d3d6da",
    text: "#222",
    background: "#fff"
};
const defaultFont = {
    fontSize: 32,
    variant: "Bold",
    letterSpacing: "0.1em",
    lineHeight: "1em"
};

function getLetterStatuses(guess, answer) {
    const result = Array(5).fill("absent");
    const answerArr = answer.split("");
    const guessArr = guess.split("");
    const used = Array(5).fill(false);

    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === answerArr[i]) {
            result[i] = "correct";
            used[i] = true;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (result[i] === "correct") continue;
        for (let j = 0; j < 5; j++) {
            if (!used[j] && guessArr[i] === answerArr[j]) {
                result[i] = "present";
                used[j] = true;
                break;
            }
        }
    }

    return result;
}

/**
 * Passwordle
 *
 * @framerIntrinsicWidth 350
 * @framerIntrinsicHeight 450
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function Passwordle(props) {
    const {
        word = defaultWord,
        redirectUrl = defaultRedirect,
        maxAttempts = 5,
        correctColor,
        presentColor,
        absentColor,
        emptyColor,
        textColor,
        backgroundColor,
        font,
        style,
        title = "Passwordle",
        winText = "Access Granted",
        failText = "Access Denied",
        revealTitle = "Word: ",
        openRedirectInNewTab = false
    } = props;

    const answer = word.trim().toUpperCase().slice(0, 5);
    const [guesses, setGuesses] = useState([]);
    const [current, setCurrent] = useState("");
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const inputRef = useRef(null);

    // Keyboard input
    useEffect(() => {
        if (status !== "") return;

        function onKeyDown(e) {
            const target = RenderTarget.current();
            if (target !== RenderTarget.preview && target !== RenderTarget.canvas) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (guesses.length >= maxAttempts) return;

            if (e.key === "Backspace") {
                if (current.length > 0) startTransition(() => setCurrent(current.slice(0, -1)));
                setError("");
            } else if (/^[a-zA-Z]$/.test(e.key)) {
                if (current.length < 5) startTransition(() => setCurrent(current + e.key.toUpperCase()));
                setError("");
            } else if (e.key === "Enter") {
                if (current.length === 5) {
                    if (current === answer) {
                        startTransition(() => {
                            setGuesses([...guesses, current]);
                            setStatus("success");
                        });
                        setTimeout(() => {
                            if (typeof window !== "undefined") {
                                if (openRedirectInNewTab) {
                                    window.open(redirectUrl, "_blank");
                                } else {
                                    window.location.href = redirectUrl;
                                }
                            }
                        }, 800);
                    } else {
                        startTransition(() => setGuesses([...guesses, current]));
                        setError("");
                        if (guesses.length + 1 >= maxAttempts) {
                            setStatus("fail");
                        }
                    }
                    startTransition(() => setCurrent(""));
                }
            }
        }

        // Always focus input on desktop/canvas/preview
        if (inputRef.current) inputRef.current.focus();
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [current, guesses, answer, maxAttempts, status, redirectUrl, openRedirectInNewTab]);

    // Focus hidden input on press (mobile/tablet)
    const handleContainerClick = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Hidden input for mobile/tablet keyboard
    const isStatic = useIsStaticRenderer();
    const rows = useMemo(() => {
        const out = [];
        for (let i = 0; i < maxAttempts; i++) {
            if (i < guesses.length) {
                const guess = guesses[i];
                const statuses = getLetterStatuses(guess, answer);
                out.push({ guess, statuses, submitted: true });
            } else if (i === guesses.length && status !== "success" && status !== "fail") {
                out.push({ guess: current.padEnd(5, " "), statuses: Array(5).fill("empty"), submitted: false });
            } else {
                out.push({ guess: " ".repeat(5), statuses: Array(5).fill("empty"), submitted: false });
            }
        }
        return out;
    }, [guesses, current, maxAttempts, answer, status]);

    const colorMap = {
        correct: correctColor || defaultColors.correct,
        present: presentColor || defaultColors.present,
        absent: absentColor || defaultColors.absent,
        empty: emptyColor || defaultColors.empty
    };

    const isFixedWidth = style && style.width === "100%";

    return /*#__PURE__*/_jsxs("div", {
        style: {
            ...style,
            background: backgroundColor || defaultColors.background,
            color: textColor || defaultColors.text,
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: 24,
            minWidth: isFixedWidth ? undefined : 350,
            minHeight: 450,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            position: "relative",
            width: "100%",
            boxSizing: "border-box",
            height: "auto"
        },
        tabIndex: -1,
        onClick: handleContainerClick,
        children: [
            /*#__PURE__*/_jsx("input", {
                ref: inputRef,
                type: "text",
                inputMode: "text",
                autoComplete: "off",
                autoCorrect: "off",
                spellCheck: false,
                style: {
                    position: "absolute",
                    opacity: 0,
                    pointerEvents: "none",
                    width: 0,
                    height: 0,
                    zIndex: -1
                },
                tabIndex: 0,
                "aria-hidden": "true"
            }),
            /*#__PURE__*/_jsx("div", {
                style: {
                    fontWeight: 700,
                    fontSize: 20,
                    marginBottom: 32,
                    ...font
                },
                children: title
            }),
            /*#__PURE__*/_jsx("div", {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    width: "100%",
                    maxWidth: 300,
                    alignItems: "center"
                },
                children: rows.map((row, i) => /*#__PURE__*/_jsx("div", {
                    style: {
                        display: "flex",
                        gap: 6
                    },
                    children: row.guess.split("").map((ch, j) => {
                        const isFilled = ch.trim() !== "" && row.statuses[j] === "empty" && !row.submitted;
                        const shouldFlip = row.submitted && row.statuses[j] !== "empty";

                        if (isStatic) {
                            return /*#__PURE__*/_jsx("div", {
                                style: {
                                    width: 48,
                                    height: 48,
                                    background: colorMap[row.statuses[j]],
                                    color: textColor || defaultColors.text,
                                    borderRadius: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 28,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    border: row.statuses[j] === "empty" ? `1.5px solid #bbb` : "none",
                                    ...font
                                },
                                "aria-label": ch.trim() ? ch : undefined,
                                children: ch
                            }, j);
                        }

                        return /*#__PURE__*/_jsx(motion.div, {
                            initial: isFilled ? { scale: .7, opacity: 0 } : false,
                            animate: isFilled ? { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 20 } } : {},
                            whileInView: shouldFlip ? { rotateY: 360, transition: { duration: .7, delay: j * .08 } } : {},
                            style: {
                                width: 48,
                                height: 48,
                                background: colorMap[row.statuses[j]],
                                color: textColor || defaultColors.text,
                                borderRadius: 4,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 28,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                border: row.statuses[j] === "empty" ? `1.5px solid #bbb` : "none",
                                perspective: 400,
                                ...font
                            },
                            "aria-label": ch.trim() ? ch : undefined,
                            children: ch
                        }, j);
                    })
                }, i))
            }),
            status === "success" && /*#__PURE__*/_jsx("div", {
                style: {
                    color: colorMap.correct,
                    fontWeight: 700,
                    marginTop: 12
                },
                children: winText
            }),
            status === "fail" && /*#__PURE__*/_jsxs("div", {
                style: {
                    color: colorMap.absent,
                    fontWeight: 700,
                    marginTop: 12
                },
                children: [failText, /*#__PURE__*/_jsx("br", {}), revealTitle, answer]
            }),
            error && /*#__PURE__*/_jsx("div", {
                style: {
                    color: "#d32f2f",
                    marginTop: 8
                },
                children: error
            }),
            /*#__PURE__*/_jsx("div", {
                style: {
                    fontSize: 13,
                    color: "#888",
                    marginTop: 8,
                    textAlign: "center"
                },
                children: status === "" ? /*#__PURE__*/_jsxs(_Fragment, {
                    children: ["Guess the 5-letter password. Attempts left: ", " ", maxAttempts - guesses.length]
                }) : status === "fail" ? /*#__PURE__*/_jsx("button", {
                    "aria-label": "Reset",
                    onClick: () => {
                        startTransition(() => {
                            setGuesses([]);
                            setCurrent("");
                            setStatus("");
                            setError("");
                        });
                    },
                    style: {
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        margin: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#888"
                    },
                    children: /*#__PURE__*/_jsxs("svg", {
                        width: "24",
                        height: "24",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        "aria-hidden": "true",
                        children: [/*#__PURE__*/_jsx("path", {
                            d: "M1 4v6h6"
                        }), /*#__PURE__*/_jsx("path", {
                            d: "M3.51 9a9 9 0 1 0 2.13-3.36L1 10"
                        })]
                    })
                }) : null
            })
        ]
    });
}

addPropertyControls(Passwordle, {
    title: {
        type: controlType.String,
        title: "Title",
        defaultValue: "Passwordle"
    },
    word: {
        type: controlType.String,
        title: "Password Word",
        defaultValue: defaultWord,
        placeholder: "5-letter word"
    },
    redirectUrl: {
        type: controlType.String,
        title: "Redirect URL",
        defaultValue: defaultRedirect,
        placeholder: "https://..."
    },
    openRedirectInNewTab: {
        type: controlType.Boolean,
        title: "Open Redirect In",
        enabledTitle: "New Tab",
        disabledTitle: "Current Tab",
        defaultValue: false
    },
    maxAttempts: {
        type: controlType.Number,
        title: "Max Attempts",
        defaultValue: 5,
        min: 3,
        max: 10,
        step: 1
    },
    correctColor: {
        type: controlType.Color,
        title: "Correct Color",
        defaultValue: defaultColors.correct
    },
    presentColor: {
        type: controlType.Color,
        title: "Present Color",
        defaultValue: defaultColors.present
    },
    absentColor: {
        type: controlType.Color,
        title: "Absent Color",
        defaultValue: defaultColors.absent
    },
    emptyColor: {
        type: controlType.Color,
        title: "Empty Color",
        defaultValue: defaultColors.empty
    },
    textColor: {
        type: controlType.Color,
        title: "Text Color",
        defaultValue: defaultColors.text
    },
    backgroundColor: {
        type: controlType.Color,
        title: "Background",
        defaultValue: defaultColors.background
    },
    font: {
        type: controlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: defaultFont
    },
    winText: {
        type: controlType.String,
        title: "Success Text",
        defaultValue: "Access Granted"
    },
    failText: {
        type: controlType.String,
        title: "Fail Text",
        defaultValue: "Access Denied"
    },
    revealTitle: {
        type: controlType.String,
        title: "Reveal Title",
        defaultValue: "Word: "
    }
});

export const __FramerMetadata__ = {
    "exports": {
        "default": {
            "type": "reactComponent",
            "name": "Passwordle",
            "slots": [],
            "annotations": {
                "framerIntrinsicHeight": "450",
                "framerContractVersion": "1",
                "framerSupportedLayoutWidth": "any-prefer-fixed",
                "framerSupportedLayoutHeight": "auto",
                "framerIntrinsicWidth": "350"
            }
        },
        "__FramerMetadata__": {
            "type": "variable"
        }
    }
};