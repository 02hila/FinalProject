/**
 * ExpandableText.jsx
 *
 * A text display component that truncates content to a specified number of lines
 * and provides a "show more / show less" toggle button when the text overflows.
 * Uses CSS `-webkit-line-clamp` for visual truncation and measures actual scroll
 * height versus the clamped height to decide whether the toggle is needed.
 *
 * Props:
 *  - text         (string)  The text content to display.
 *  - maxLines     (number)  Maximum visible lines before truncation (default 2).
 *  - className    (string)  Additional CSS class for the container.
 *  - style        (Object)  Additional inline styles for the text element.
 *  - showMoreText (string)  Label for the expand button (default Hebrew "show more").
 *  - showLessText (string)  Label for the collapse button (default Hebrew "show less").
 *
 * Used by: ad card components and listing views wherever long ad descriptions or
 * generated text should be shown in a compact form.
 */
import React, { useState, useRef, useEffect } from 'react';

/**
 * Renders text that can be expanded or collapsed when its content exceeds the
 * configured line limit.
 *
 * @param {Object}  props
 * @param {string}  props.text         - The text to display.
 * @param {number}  [props.maxLines=2] - Number of visible lines before clamping.
 * @param {string}  [props.className]  - Extra CSS class for the wrapper div.
 * @param {Object}  [props.style]      - Inline styles merged into the text element.
 * @param {string}  [props.showMoreText] - Custom label for the "expand" button.
 * @param {string}  [props.showLessText] - Custom label for the "collapse" button.
 * @returns {React.ReactElement}
 */
const ExpandableText = ({
    text,
    maxLines = 2,
    className = '',
    style = {},
    showMoreText = 'הצג עוד',
    showLessText = 'הצג פחות'
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const textRef = useRef(null);

    /**
     * Checks whether the text element's full scroll height exceeds the
     * maximum allowed height (line-height * maxLines). Re-runs whenever
     * the text, maxLines, or window size changes.
     */
    useEffect(() => {
        const checkOverflow = () => {
            if (textRef.current) {
                const element = textRef.current;
                // Compare the actual scrollable height against the clamped max height.
                const lineHeight = parseInt(window.getComputedStyle(element).lineHeight) || 20;
                const maxHeight = lineHeight * maxLines;
                setIsOverflowing(element.scrollHeight > maxHeight + 5); // 5px tolerance
            }
        };

        checkOverflow();
        // Recheck on window resize
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [text, maxLines]);

    const textStyle = {
        ...style,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        WebkitLineClamp: isExpanded ? 'unset' : maxLines,
        lineHeight: '1.6',
        transition: 'all 0.3s ease',
    };

    const expandedStyle = {
        ...style,
        display: 'block',
        overflow: 'visible',
        lineHeight: '1.6',
    };

    const buttonStyle = {
        background: 'none',
        border: 'none',
        color: '#667eea',
        cursor: 'pointer',
        padding: '5px 0',
        fontSize: '13px',
        fontWeight: '600',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        marginTop: '5px',
    };

    return (
        <div className={`expandable-text-container ${className}`}>
            <div
                ref={textRef}
                style={isExpanded ? expandedStyle : textStyle}
                className="expandable-text-content"
            >
                {text || 'אין טקסט'}
            </div>
            {isOverflowing && (
                <button
                    style={buttonStyle}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className="expandable-text-toggle"
                >
                    {isExpanded ? (
                        <>
                            <i className="fas fa-chevron-up"></i>
                            {showLessText}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-chevron-down"></i>
                            {showMoreText}
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default ExpandableText;
