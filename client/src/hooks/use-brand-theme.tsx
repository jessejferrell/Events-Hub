import { useEffect, useCallback } from 'react';
import { useSiteSettings } from '@/hooks/use-site-settings';

/**
 * A hook that applies site branding settings to the application.
 * This updates CSS variables in the :root element to apply colors site-wide.
 */
export function useBrandTheme() {
  const { settings, getSetting, isLoading } = useSiteSettings();
  
  // Helper to convert hex to HSL format for CSS variables
  const hexToHSL = useCallback((hex: string): string => {
    try {
      // Remove the # if it exists
      hex = hex.replace('#', '');
      
      // Parse the hex color to RGB
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      
      // Find greatest and smallest channel values
      const cmin = Math.min(r, g, b);
      const cmax = Math.max(r, g, b);
      const delta = cmax - cmin;
      
      // Initialize variables
      let h = 0;
      let s = 0;
      let l = (cmax + cmin) / 2;
      
      // Calculate hue
      if (delta !== 0) {
        if (cmax === r) {
          h = ((g - b) / delta) % 6;
        } else if (cmax === g) {
          h = (b - r) / delta + 2;
        } else {
          h = (r - g) / delta + 4;
        }
        
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        
        // Calculate saturation
        s = delta / (1 - Math.abs(2 * l - 1));
      }
      
      // Convert to percentages
      s = Math.round(s * 100);
      l = Math.round(l * 100);
      
      return `${h} ${s}% ${l}%`;
    } catch (e) {
      console.error('Error in hexToHSL:', e);
      return '174 75% 37%'; // Default teal as fallback
    }
  }, []);
  
  useEffect(() => {
    if (isLoading || !settings) return;
    
    // Get color settings
    const colors = getSetting('colors');
    if (!colors) return;
    
    try {
      // Apply colors to CSS variables
      const root = document.documentElement;
      
      // Apply each color if available
      if (colors.primary) {
        root.style.setProperty('--primary', hexToHSL(colors.primary));
        root.style.setProperty('--primary-foreground', '#ffffff');
      }
      
      if (colors.secondary) {
        root.style.setProperty('--secondary', hexToHSL(colors.secondary));
        root.style.setProperty('--secondary-foreground', '#ffffff');
      }
      
      if (colors.accent) {
        root.style.setProperty('--accent', hexToHSL(colors.accent));
        root.style.setProperty('--accent-foreground', '#000000');
      }
      
      // Update ring color to match primary
      if (colors.primary) {
        root.style.setProperty('--ring', hexToHSL(colors.primary));
      }
      
      console.log('Applied brand colors successfully');
    } catch (e) {
      console.error('Error applying brand colors:', e);
    }
  }, [isLoading, settings, getSetting, hexToHSL]);
  
  // Return brand-related data from settings
  return {
    orgName: !isLoading && settings ? getSetting('orgSettings')?.name : null,
    orgLogo: !isLoading && settings ? getSetting('orgSettings')?.logo : null,
    colors: !isLoading && settings ? getSetting('colors') : null,
    isLoading
  };
}