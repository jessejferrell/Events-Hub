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
        
        if (colors.primary) {
          root.style.setProperty('--primary', colors.primary);
          // Set derived color variables (darker/lighter variants)
          root.style.setProperty('--primary-foreground', getContrastingColor(colors.primary));
        }
        
        if (colors.secondary) {
          root.style.setProperty('--secondary', colors.secondary);
          root.style.setProperty('--secondary-foreground', getContrastingColor(colors.secondary));
        }
        
        if (colors.accent) {
          root.style.setProperty('--accent', colors.accent);
          root.style.setProperty('--accent-foreground', getContrastingColor(colors.accent));
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