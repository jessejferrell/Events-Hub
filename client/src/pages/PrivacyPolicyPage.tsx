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
            <p className="text-sm text-gray-500 mb-6">Last Updated: May 7, 2025</p>
            
            <h2>Introduction</h2>
            <p>
              At Experienced Results, we value your privacy and are committed to protecting your personal information. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our 
              City Event Hub platform (the "Platform").
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
              <li>Develop, improve, and train artificial intelligence and machine learning models</li>
              <li>Analyze user behavior and usage patterns to enhance our services</li>
              <li>Create aggregated datasets that may be shared with or sold to third parties</li>
              <li>Conduct research and development activities for new products and services</li>
              <li>Personalize your experience and deliver targeted content</li>
              <li>Detect and prevent fraudulent transactions and platform abuse</li>
            </ul>
            
            <h2>Data Use and Collection for AI Training and Commercial Purposes</h2>
            <p>
              By using our Platform, you acknowledge and agree that we may collect, use, process, and store your data for various purposes, including:
            </p>
            <ul>
              <li>Training and improving artificial intelligence and machine learning models</li>
              <li>Analyzing patterns and trends in user behavior and event participation</li>
              <li>Creating derivative works based on anonymized or aggregated user data</li>
              <li>Selling or licensing anonymized datasets or derived insights to third-party companies</li>
              <li>Developing new products, services, or features based on platform usage data</li>
            </ul>
            <p>
              You consent to our use of your data for these purposes, and you acknowledge that we retain all rights to any derivative works, models, or insights created using data collected through the Platform.
            </p>
            
            <h2>Information Sharing and Sales</h2>
            <p>
              We may share or sell your information with:
            </p>
            <ul>
              <li>Third-party companies who may purchase anonymized or aggregated data</li>
              <li>Business partners who may use the data for marketing, research, or product development</li>
              <li>Event organizers who need attendee, vendor, or volunteer information to manage events</li>
              <li>Service providers who assist us in operating the Platform</li>
              <li>Law enforcement or government entities when required by law</li>
            </ul>
            <p>
              We retain the right to transfer, sell, or assign any data we collect to third parties at our discretion, in compliance with applicable laws.
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
            <p>
              Please note that certain data usage rights may be limited where we have compelling legitimate grounds for processing 
              or where data has been anonymized or aggregated and can no longer be associated with you personally.
            </p>
            
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
              Experienced Results<br/>
              P.O. Box 1522<br/>
              Escatawpa, MS 39552<br/>
              Email: jj@expresults.com
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}