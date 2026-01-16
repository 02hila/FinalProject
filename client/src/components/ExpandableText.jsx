import React, { useState, useRef, useEffect } from 'react';

/**
 * ExpandableText - A component that shows truncated text with a "show more" button
 * when the text overflows the specified number of lines.
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

    useEffect(() => {
        const checkOverflow = () => {
            if (textRef.current) {
                const element = textRef.current;
                // Check if content height exceeds the clamped height
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
