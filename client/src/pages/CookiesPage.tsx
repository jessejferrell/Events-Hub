import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function CookiesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-primary">Cookies Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-sm text-gray-500 mb-6">Last Updated: May 7, 2025</p>
            
            <h2>Introduction</h2>
            <p>
              This Cookies Policy explains how Experienced Results ("we", "us", or "our") uses cookies, pixel tags, 
              local storage, and other similar technologies (collectively referred to as "cookies") when you visit our 
              City Event Hub platform (the "Platform"). This policy is designed to help you understand what 
              cookies are, why we use them, and the types of cookies we use.
            </p>
            
            <h2>What Are Cookies?</h2>
            <p>
              Cookies are small text files that are stored on your computer or mobile device when you visit 
              a website. They allow the website to recognize your device and remember if you've been to the 
              website before. Cookies are widely used to make websites work more efficiently, provide a 
              personalized experience, and to provide reporting information.
            </p>
            
            <h2>Why We Use Cookies</h2>
            <p>We use cookies for several reasons, including to:</p>
            <ul>
              <li>Make our Platform work as you'd expect</li>
              <li>Remember your settings during and between visits</li>
              <li>Improve the speed/security of the Platform</li>
              <li>Personalize our Platform to you to help you get what you need faster</li>
              <li>Allow you to share pages with social networks like Facebook</li>
              <li>Continuously improve our Platform for you</li>
              <li>Make our marketing more efficient</li>
              <li>Collect behavioral data for AI model training and improvement</li>
              <li>Gather analytics data for business intelligence and commercial purposes</li>
              <li>Build user profiles for targeted advertising and content personalization</li>
            </ul>
            
            <h2>Types of Cookies We Use</h2>
            <h3>Essential Cookies</h3>
            <p>
              These cookies are necessary for the Platform to function properly. They enable basic functions 
              like page navigation and access to secure areas of the Platform. The Platform cannot function 
              properly without these cookies.
            </p>
            
            <h3>Performance Cookies</h3>
            <p>
              These cookies collect information about how you use the Platform, such as which pages you visit 
              most often and if you get error messages from web pages. These cookies don't collect information 
              that identifies you personally. All information these cookies collect is aggregated and anonymous 
              and is only used to improve how the Platform works.
            </p>
            
            <h3>Functionality Cookies</h3>
            <p>
              These cookies allow the Platform to remember choices you make (such as your username, language, 
              or the region you are in) and provide enhanced, more personal features. They may also be used to 
              provide services you have asked for, such as watching a video. The information these cookies 
              collect may be anonymized, and they cannot track your browsing activity on other websites.
            </p>
            
            <h3>Targeting/Advertising Cookies</h3>
            <p>
              These cookies are used to deliver advertisements more relevant to you and your interests. They are 
              also used to limit the number of times you see an advertisement as well as help measure the 
              effectiveness of advertising campaigns. They are usually placed by advertising networks with the 
              website operator's permission. They remember that you have visited a website and this information 
              is shared with other organizations such as advertisers.
            </p>
            
            <h3>Third-Party Cookies</h3>
            <p>
              Some cookies are placed by third parties on our behalf. These third parties may include analytics 
              providers (such as Google Analytics), advertising networks, social media platforms, and payment 
              processors. These cookies allow us to understand how users interact with our Platform, customize 
              advertising, enable social media features, and process payments securely.
            </p>
            
            <h2>Data Collection and Use Through Cookies</h2>
            <p>
              Through cookies, we collect information about your device, browsing actions, and patterns. This may include:
            </p>
            <ul>
              <li>Technical information about your device and browser, including IP address, browser type and version, time zone setting, operating system, and platform</li>
              <li>Information about your visit, including the full URL clickstream to, through, and from our Platform, products you viewed or searched for, page response times, download errors, length of visits to certain pages, page interaction information, and methods used to browse away from the page</li>
              <li>Behavioral data and usage patterns to enhance our AI and machine learning capabilities</li>
              <li>Information for creating user profiles and data sets that may be shared with or sold to third parties in anonymized form</li>
            </ul>
            <p>
              By using our Platform, you consent to the processing of your data through cookies as described in this policy 
              and our Privacy Policy. You acknowledge that we may use this data for commercial purposes, including but not 
              limited to AI training, data aggregation and sales, and business intelligence.
            </p>
            
            <h2>Controlling Cookies</h2>
            <p>
              Most web browsers allow you to control cookies through their settings preferences. However, 
              if you limit the ability of websites to set cookies, you may impact your overall user experience. 
              To find out more about cookies, including how to see what cookies have been set and how to manage 
              and delete them, visit <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer">www.allaboutcookies.org</a>.
            </p>
            <p>
              Please note that essential cookies cannot be disabled, as they are necessary for the functioning of our Platform.
            </p>
            
            <h2>Changes to this Cookies Policy</h2>
            <p>
              We may update this Cookies Policy from time to time to reflect changes in technology, regulation, 
              or our business practices. Any changes will be posted on this page, and if the changes are significant, 
              we will provide a more prominent notice.
            </p>
            
            <h2>Contact Us</h2>
            <p>
              If you have any questions about our use of cookies, please contact us at:
            </p>
            <p>
              Experienced Results<br/>
              Email: events@mosspointmainstreet.org
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}