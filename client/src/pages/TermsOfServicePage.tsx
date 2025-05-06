import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-primary">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-sm text-gray-500 mb-6">Last Updated: May 6, 2025</p>
            
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Moss Point Main Street events platform ("Platform") at events.mosspointmainstreet.org, 
              you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Platform.
            </p>
            
            <h2>2. Description of Service</h2>
            <p>
              The Platform provides event management services, including event listings, ticket sales, vendor registrations, 
              volunteer coordination, and related services for community events organized by Moss Point Main Street and affiliated organizations.
            </p>
            
            <h2>3. User Accounts</h2>
            <p>
              To access certain features of the Platform, you must register for an account. You are responsible for maintaining 
              the confidentiality of your account credentials and for all activities that occur under your account. You agree to 
              provide accurate and complete information when creating your account and to keep this information updated.
            </p>
            
            <h2>4. Event Tickets and Registrations</h2>
            <p>
              When purchasing tickets or registering for events through our Platform:
            </p>
            <ul>
              <li>All ticket sales are final and non-refundable unless otherwise stated in the specific event's refund policy.</li>
              <li>Event organizers reserve the right to modify event details, including date, time, and venue, with reasonable notice.</li>
              <li>Tickets are valid only for the specified event and date and may not be transferred without authorization.</li>
              <li>Reselling tickets at prices higher than face value is prohibited unless explicitly permitted.</li>
            </ul>
            
            <h2>5. Vendor and Volunteer Registrations</h2>
            <p>
              For vendors and volunteers:
            </p>
            <ul>
              <li>Registration applications are subject to approval by event organizers.</li>
              <li>Vendors and volunteers must comply with all event-specific rules and requirements.</li>
              <li>Vendor fees may be non-refundable as specified in the event's terms.</li>
              <li>Event organizers reserve the right to reject applications or terminate participation for any reason.</li>
            </ul>
            
            <h2>6. Payments and Fees</h2>
            <p>
              All payments are processed securely through our payment service provider, Stripe. By making a payment on our Platform, you agree to:
            </p>
            <ul>
              <li>Provide current, complete, and accurate payment information.</li>
              <li>Pay all charges incurred on your account at the prices in effect when the charges are incurred.</li>
              <li>Pay any applicable taxes related to your purchase.</li>
            </ul>
            
            <h2>7. Intellectual Property</h2>
            <p>
              All content on the Platform, including text, graphics, logos, and software, is the property of Moss Point Main Street 
              or its content suppliers and is protected by United States and international copyright laws. You may not reproduce, 
              modify, distribute, or display any portion of the Platform without prior written consent.
            </p>
            
            <h2>8. User Conduct</h2>
            <p>
              You agree not to:
            </p>
            <ul>
              <li>Use the Platform for any illegal purpose or in violation of any local, state, national, or international law.</li>
              <li>Interfere with or disrupt the Platform or servers or networks connected to the Platform.</li>
              <li>Attempt to gain unauthorized access to any portion of the Platform or any other accounts, systems, or networks.</li>
              <li>Collect or harvest any information from other users without their consent.</li>
              <li>Submit content that is defamatory, offensive, or violates the privacy or rights of others.</li>
            </ul>
            
            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Moss Point Main Street shall not be liable for any indirect, incidental, 
              special, consequential, or punitive damages resulting from your access to or use of the Platform. Our liability 
              for any direct damages shall be limited to the amount paid by you for the specific event or service giving rise to such liability.
            </p>
            
            <h2>10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Moss Point Main Street, its officers, directors, employees, and agents, 
              from any claims, liabilities, damages, losses, costs, or expenses, including reasonable attorneys' fees, arising 
              out of or in any way connected with your access to or use of the Platform or your violation of these Terms.
            </p>
            
            <h2>11. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your account and access to the Platform at our sole discretion, 
              without notice, for conduct that we believe violates these Terms or is harmful to other users of the Platform or third parties.
            </p>
            
            <h2>12. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. The updated version will be effective as of the "Last Updated" date. 
              Your continued use of the Platform after any such changes constitutes your acceptance of the new Terms.
            </p>
            
            <h2>13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Mississippi, without 
              regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the courts 
              of Jackson County, Mississippi.
            </p>
            
            <h2>14. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
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