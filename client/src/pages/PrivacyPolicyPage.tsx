import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-primary">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-sm text-gray-500 mb-6">Last Updated: May 6, 2025</p>
            
            <h2>Introduction</h2>
            <p>
              At Moss Point Main Street, we value your privacy and are committed to protecting your personal information. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our 
              event management platform at events.mosspointmainstreet.org ("Platform").
            </p>
            
            <h2>Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul>
              <li>
                <strong>Personal Information:</strong> Name, email address, phone number, and billing information when you
                register for an account, purchase tickets, or register as a vendor or volunteer.
              </li>
              <li>
                <strong>Transaction Information:</strong> Details about tickets purchased, events registered for, and payments made.
              </li>
              <li>
                <strong>Usage Information:</strong> How you interact with our Platform, including pages visited, features used, 
                and actions taken.
              </li>
              <li>
                <strong>Device Information:</strong> IP address, browser type, operating system, and device identifiers.
              </li>
            </ul>
            
            <h2>How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Operate, maintain, and improve our Platform</li>
              <li>Process transactions and send related information</li>
              <li>Manage event registrations, vendor applications, and volunteer assignments</li>
              <li>Communicate with you about events, updates, and services</li>
              <li>Generate anonymized analytics data for improving our service</li>
              <li>Detect and prevent fraudulent transactions and platform abuse</li>
            </ul>
            
            <h2>Information Sharing</h2>
            <p>
              We may share your information with event organizers, service providers (such as payment processors), 
              or as required by law. Event organizers receive information necessary to manage event operations, 
              including attendee lists and vendor/volunteer information.
            </p>
            
            <h2>Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information. However, no method of 
              transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially 
              acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
            
            <h2>Your Rights</h2>
            <p>Depending on your location, you may have rights regarding your personal information, including:</p>
            <ul>
              <li>Accessing, correcting, or deleting your personal information</li>
              <li>Withdrawing consent where processing is based on consent</li>
              <li>Receiving a copy of your data in a structured, machine-readable format</li>
              <li>Restricting or objecting to certain processing activities</li>
            </ul>
            
            <h2>Cookies and Similar Technologies</h2>
            <p>
              We use cookies and similar technologies to collect information about your browsing activities, remember your 
              preferences, and provide personalized experiences. You can manage cookie preferences through your browser settings.
            </p>
            
            <h2>Children's Privacy</h2>
            <p>
              Our Platform is not directed to children under 13. We do not knowingly collect personal information from 
              children under 13. If we discover we have collected information from a child under 13, we will delete that information.
            </p>
            
            <h2>Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The updated version will be indicated by an updated 
              "Last Updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
            
            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p>
              Moss Point Main Street<br/>
              4836 Main Street<br/>
              Moss Point, MS 39563<br/>
              Email: director@mosspointmainstreet.org<br/>
              Phone: (228) 217-3277
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}