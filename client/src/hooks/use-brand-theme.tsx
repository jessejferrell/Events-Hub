import { useEffect } from 'react';
import { useSiteSettings } from '@/hooks/use-site-settings';

/**
 * A hook that applies site branding settings to the application.
 * This updates CSS variables in the :root element to apply colors site-wide.
 */
export function useBrandTheme() {
  const { settings, getSetting, isLoading } = useSiteSettings();
  
  useEffect(() => {
    if (!isLoading && settings) {
      // Get color settings
      const colors = getSetting('colors');
      
      if (colors) {
        // Apply colors to CSS variables
        const root = document.documentElement;
        
        // Helper to convert hex to HSL format for CSS variables
        const hexToHSL = (hex: string): string => {
          // Remove the # if it exists
          hex = hex.replace('#', '');
          
          // Convert hex to RGB
          const r = parseInt(hex.slice(0, 2), 16) / 255;
          const g = parseInt(hex.slice(2, 4), 16) / 255;
          const b = parseInt(hex.slice(4, 6), 16) / 255;
          
          // Find greatest and smallest channel values
          const cmin = Math.min(r, g, b);
          const cmax = Math.max(r, g, b);
          const delta = cmax - cmin;
          
          let h = 0;
          let s = 0;
          let l = 0;
          
          // Calculate hue
          if (delta === 0) {
            h = 0;
          } else if (cmax === r) {
            h = ((g - b) / delta) % 6;
          } else if (cmax === g) {
            h = (b - r) / delta + 2;
          } else {
            h = (r - g) / delta + 4;
          }
          
          h = Math.round(h * 60);
          if (h < 0) h += 360;
          
          // Calculate lightness
          l = (cmax + cmin) / 2;
          
          // Calculate saturation
          s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
          
          // Convert to percentages
          s = Math.round(s * 100);
          l = Math.round(l * 100);
          
          return `${h} ${s}% ${l}%`;
        };
        
        if (colors.primary) {
          try {
            root.style.setProperty('--primary', hexToHSL(colors.primary));
            root.style.setProperty('--primary-foreground', getContrastingColor(colors.primary));
          } catch (e) {
            console.error('Error setting primary color:', e);
          }
        }
        
        if (colors.secondary) {
          try {
            root.style.setProperty('--secondary', hexToHSL(colors.secondary));
            root.style.setProperty('--secondary-foreground', getContrastingColor(colors.secondary));
          } catch (e) {
            console.error('Error setting secondary color:', e);
          }
        }
        
        if (colors.accent) {
          try {
            root.style.setProperty('--accent', hexToHSL(colors.accent));
            root.style.setProperty('--accent-foreground', getContrastingColor(colors.accent));
          } catch (e) {
            console.error('Error setting accent color:', e);
          }
        }
      }
    }
  }, [isLoading, settings, getSetting]);
  
  // Return brand-related data from settings
  return {
    orgName: !isLoading ? getSetting('orgName') : null,
    orgLogo: !isLoading ? getSetting('orgLogo') : null,
    colors: !isLoading ? getSetting('colors') : null,
    isLoading
  };
}

/**
 * Helper function to determine if a color should have light or dark text on it
 */
function getContrastingColor(hexColor: string): string {
  // Remove the hash if it exists
  hexColor = hexColor.replace('#', '');
  
  // Parse the hex color
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  
  // Calculate luminance - a measure of how bright the color appears
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}