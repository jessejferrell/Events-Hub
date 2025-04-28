import { Link } from "wouter";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram } from "lucide-react";

export default function Footer() {
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
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary transition-colors">
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
              <li>
                <Link href="/my-events" className="text-gray-600 hover:text-primary transition-colors">
                  Create Event
                </Link>
              </li>
              <li>
                <Link href="/payment-connections" className="text-gray-600 hover:text-primary transition-colors">
                  Payment Setup
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-gray-600 hover:text-primary transition-colors">
                  My Account
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Support */}
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-primary mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/help" className="text-gray-600 hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-600 hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-600 hover:text-primary transition-colors">
                  Contact Us
                </Link>
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
                <span className="text-gray-600">123 Event Street, City Center, ST 12345</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-600">(123) 456-7890</span>
              </div>
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-600">info@cityeventhub.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Footer */}
      <div className="border-t border-gray-200">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <div>&copy; {new Date().getFullYear()} City Event Hub. All rights reserved.</div>
          <div className="flex mt-2 md:mt-0 space-x-6">
            <Link href="/privacy">
              <a className="hover:text-primary transition-colors">Privacy</a>
            </Link>
            <Link href="/terms">
              <a className="hover:text-primary transition-colors">Terms</a>
            </Link>
            <Link href="/cookies">
              <a className="hover:text-primary transition-colors">Cookies</a>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
