import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({
  options,
  value,
  onChange,
  ariaLabel,
  optionsClassName = '',
  portalOptions = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [optionsStyle, setOptionsStyle] = useState(null);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const optionsRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !dropdownRef.current?.contains(event.target)
        && !optionsRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !portalOptions) return undefined;

    const positionOptions = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = Math.min(220, options.length * 44 + 8);
      const spaceAbove = rect.top - 6;
      const spaceBelow = window.innerHeight - rect.bottom - 6;
      const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const availableSpace = openAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(80, Math.min(220, availableSpace));

      setOptionsStyle({
        position: 'fixed',
        left: rect.left,
        top: openAbove ? rect.top - 6 : rect.bottom + 6,
        width: rect.width,
        maxHeight,
        transform: openAbove ? 'translateY(-100%)' : 'none',
      });
    };

    positionOptions();
    window.addEventListener('resize', positionOptions);
    window.addEventListener('scroll', positionOptions, true);
    return () => {
      window.removeEventListener('resize', positionOptions);
      window.removeEventListener('scroll', positionOptions, true);
    };
  }, [isOpen, options.length, portalOptions]);

  const optionsMenu = isOpen && (
    <div
      ref={optionsRef}
      className={`custom-select-options ${optionsClassName}`.trim()}
      role="listbox"
      style={portalOptions ? optionsStyle : undefined}
    >
      {options.map((option) => (
        <div
          key={option.value}
          role="option"
          aria-selected={option.value === value}
          className={`custom-select-option ${option.value === value ? 'selected' : ''}`}
          onClick={() => {
            onChange(option.value);
            setIsOpen(false);
          }}
        >
          {option.label}
        </div>
      ))}
    </div>
  );

  return (
    <div className="custom-select-container" ref={dropdownRef}>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen((open) => !open);
          } else if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      >
        <span>{selectedOption.label}</span>
        <svg
          className={`select-arrow ${isOpen ? 'rotated' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {portalOptions && optionsMenu ? createPortal(optionsMenu, document.body) : optionsMenu}
    </div>
  );
}