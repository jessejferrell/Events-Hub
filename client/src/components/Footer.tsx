import { Link } from "wouter";
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Footer() {
  const { user } = useAuth();
  
  // Determine if user has certain roles
  const isAdmin = user?.role === 'admin';
  const isEventOwner = user?.role === 'event_owner';
  
  return (
    <footer className="mt-auto bg-gradient-to-r from-primary/5 to-secondary/5">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-primary mb-4">City Event Hub</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your one-stop platform for discovering, creating, and managing local events in your community.
            </p>
            <div className="flex space-x-4 mt-4">
              <a href="https://www.facebook.com/MossPointMainStreet" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.youtube.com/playlist?list=PLG5wmM4lFjDhQKrmpOYby8ulryk4yWWd6" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/mpmainstreet/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-primary mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/events" className="text-gray-600 hover:text-primary transition-colors">
                  Browse Events
                </Link>
              </li>
              {/* Only show create event to event owners and admins */}
              {(isEventOwner || isAdmin) && (
                <li>
                  <Link href="/my-events" className="text-gray-600 hover:text-primary transition-colors">
                    Create Event
                  </Link>
                </li>
              )}
              {/* Only show payment setup to event owners and admins */}
              {(isEventOwner || isAdmin) && (
                <li>
                  <Link href="/payment-connections" className="text-gray-600 hover:text-primary transition-colors">
                    Payment Setup
                  </Link>
                </li>
              )}
              {/* Show to all logged in users */}
              {user && (
                <li>
                  <Link href="/profile" className="text-gray-600 hover:text-primary transition-colors">
                    My Account
                  </Link>
                </li>
              )}
              {/* Admin-only links */}
              {isAdmin && (
                <li>
                  <Link href="/admin" className="text-gray-600 hover:text-primary transition-colors">
                    Admin Dashboard
                  </Link>
                </li>
              )}
              {isAdmin && (
                <li>
                  <Link href="/email-notifications" className="text-gray-600 hover:text-primary transition-colors">
                    Email Manager
                  </Link>
                </li>
              )}
            </ul>
          </div>
          
          {/* Support */}
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-primary mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href="https://mosspointmainstreet.org/contact-us/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-600 hover:text-primary transition-colors"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-600 hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-600 hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Contact */}
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-primary mb-4">Contact Us</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-primary mr-2 mt-0.5" />
                <span className="text-gray-600">4836 Main Street Moss Point, MS 39563</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-600">(228) 217-3277</span>
              </div>
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-600">director@mosspointmainstreet.org</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Footer */}
      <div className="border-t border-gray-200">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
            <span>&copy; {new Date().getFullYear()} Experienced Results. All rights reserved.</span>
            <span className="hidden md:inline">|</span>
            <span>Designed & Managed by Experienced Results</span>
          </div>
          <div className="flex mt-2 md:mt-0 space-x-6">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-primary transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}