'use client';

import { useEffect, useRef, useState } from 'react';

export default function FadeIn({ children, className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const currentRef = domRef.current;
    
    // Provide a small delay fallback in case IO is not supported or too fast
    let timer;
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      
      if (currentRef) observer.observe(currentRef);
      
      return () => {
        if (currentRef) observer.unobserve(currentRef);
      };
    } else {
      timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div
      ref={domRef}
      className={`fade-in ${isVisible ? 'visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
