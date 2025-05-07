import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfServicePage() {
  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
          <CardDescription>Last Updated: May 7, 2025</CardDescription>
        </CardHeader>
        <CardContent className="prose max-w-none">
          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
              <p>
                Welcome to City Event Hub (the "Platform"). The Platform is owned and operated by Experienced Results ("Company", "we", "us", or "our"), a business with its principal place of business at P.O. Box 1522, Escatawpa, MS 39552.
              </p>
              <p>
                These Terms of Service ("Terms") govern your access to and use of the Platform, including any content, functionality, and services offered on or through the Platform, whether as a guest or a registered user.
              </p>
              <p>
                Please read these Terms carefully before you start to use the Platform. By using the Platform, you accept and agree to be bound and abide by these Terms. If you do not agree to these Terms, you must not access or use the Platform.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-2">2. Eligibility</h2>
              <p>
                The Platform is offered and available to users who are 18 years of age or older. By using the Platform, you represent and warrant that you are of legal age to form a binding contract with the Company and meet all of the foregoing eligibility requirements.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-2">3. Account Registration and Security</h2>
              <p>
                To access certain features of the Platform, you may be required to register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
              </p>
              <p>
                You are responsible for safeguarding the password that you use to access the Platform and for any activities or actions under your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Intellectual Property Rights</h2>
              <p>
                The Platform and its entire contents, features, and functionality (including but not limited to all information, software, text, displays, images, video, and audio, and the design, selection, and arrangement thereof) are owned by the Company, its licensors, or other providers of such material and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
              </p>
              <p>
                You must not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any of the material on our Platform, except as follows:
              </p>
              <ul className="list-disc pl-5">
                <li>Your computer may temporarily store copies of such materials incidental to your accessing and viewing those materials.</li>
                <li>You may store files that are automatically cached by your Web browser for display enhancement purposes.</li>
                <li>You may print one copy of a reasonable number of pages of the Platform for your own personal, non-commercial use and not for further reproduction, publication, or distribution.</li>
                <li>If we provide social media features with certain content, you may take such actions as are enabled by such features.</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-2">5. User Contributions</h2>
              <p>
                The Platform may contain message boards, chat rooms, personal web pages or profiles, forums, bulletin boards, and other interactive features (collectively, "Interactive Services") that allow users to post, submit, publish, display, or transmit to other users or other persons (hereinafter, "post") content or materials (collectively, "User Contributions") on or through the Platform.
              </p>
              <p>
                All User Contributions must comply with the Content Standards set out in these Terms. Any User Contribution you post to the Platform will be considered non-confidential and non-proprietary. By providing any User Contribution on the Platform, you grant us and our affiliates and service providers, and each of their and our respective licensees, successors, and assigns an irrevocable, perpetual, worldwide, non-exclusive, royalty-free, transferable, sublicensable right to use, reproduce, modify, perform, display, distribute, and otherwise disclose to third parties any such material for any purpose, including but not limited to:
              </p>
              <ul className="list-disc pl-5">
                <li>Developing, improving, and training artificial intelligence and machine learning models;</li>
                <li>Analyzing user behavior and usage patterns to enhance the Platform;</li>
                <li>Marketing, advertising, and promotional purposes;</li>
                <li>Research and development of new products and services;</li>
                <li>Aggregating, anonymizing, and selling data derived from User Contributions;</li>
                <li>Any other purpose deemed appropriate by Experienced Results in its sole discretion.</li>
              </ul>
              <p>
                You represent and warrant that you own or control all rights in and to the User Contributions and have the right to grant the license granted above to us and our affiliates and service providers, and each of their and our respective licensees, successors, and assigns.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Content Standards</h2>
              <p>
                These content standards apply to any and all User Contributions and use of Interactive Services. User Contributions must in their entirety comply with all applicable federal, state, local, and international laws and regulations.
              </p>
              <p>
                Without limiting the foregoing, User Contributions must not:
              </p>
              <ul className="list-disc pl-5">
                <li>Contain any material that is defamatory, obscene, indecent, abusive, offensive, harassing, violent, hateful, inflammatory, or otherwise objectionable.</li>
                <li>Promote sexually explicit or pornographic material, violence, or discrimination based on race, sex, religion, nationality, disability, sexual orientation, or age.</li>
                <li>Infringe any patent, trademark, trade secret, copyright, or other intellectual property or other rights of any other person.</li>
                <li>Violate the legal rights (including the rights of publicity and privacy) of others or contain any material that could give rise to any civil or criminal liability under applicable laws or regulations.</li>
                <li>Be likely to deceive any person.</li>
                <li>Promote any illegal activity, or advocate, promote, or assist any unlawful act.</li>
                <li>Cause annoyance, inconvenience, or needless anxiety or be likely to upset, embarrass, alarm, or annoy any other person.</li>
                <li>Impersonate any person, or misrepresent your identity or affiliation with any person or organization.</li>
                <li>Involve commercial activities or sales, such as contests, sweepstakes, and other sales promotions, barter, or advertising, without our prior written consent.</li>
                <li>Give the impression that they emanate from or are endorsed by us or any other person or entity, if this is not the case.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">7. Data Use and Collection</h2>
              <p>
                By using the Platform, you acknowledge and agree that we may collect, use, process, and store data about you, your use of the Platform, and your interactions with us for various purposes, as described in our Privacy Policy. This includes using your data to:
              </p>
              <ul className="list-disc pl-5">
                <li>Enhance and improve the Platform and our other products and services;</li>
                <li>Develop and train machine learning and artificial intelligence models;</li>
                <li>Analyze user behavior and usage patterns;</li>
                <li>Create aggregated datasets that may be shared with or sold to third parties;</li>
                <li>Personalize your experience and deliver targeted content and advertisements;</li>
                <li>Conduct research and development activities;</li>
                <li>Fulfill any other purpose disclosed by us when you provide the information.</li>
              </ul>
              <p>
                You agree that we have the right to share, sell, license, or otherwise transfer any data we collect about you to third parties at our discretion, provided we do so in compliance with applicable laws.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-2">8. E-Commerce and Payment Terms</h2>
              <p>
                The Platform may offer opportunities to purchase tickets, vendor spaces, or other products and services related to events. When making a purchase through the Platform, you agree to provide current, complete, and accurate purchase and account information. You agree to promptly update your account and other information, including your email address and credit card numbers and expiration dates, so that we can complete your transactions and contact you as needed.
              </p>
              <p>
                All payments made through the Platform are processed by third-party payment processors. By making a purchase, you agree to the terms and conditions of these payment processors. We are not responsible for errors made by payment processors.
              </p>
              <p>
                Prices for products and services offered on the Platform are subject to change at any time without notice. We reserve the right to refuse any order placed through the Platform for any reason, including but not limited to suspected fraud or unauthorized or illegal activity.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">9. Refund Policy</h2>
              <p>
                All purchases made through the Platform are final and non-refundable unless otherwise specified at the time of purchase or required by law. In the event an event is canceled by the organizer, refunds will be issued according to the organizer's refund policy, which will be disclosed on the event page. We reserve the right to issue refunds at our sole discretion.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">10. Limitation of Liability</h2>
              <p>
                IN NO EVENT WILL THE COMPANY, ITS AFFILIATES, LICENSORS, SERVICE PROVIDERS, EMPLOYEES, AGENTS, OFFICERS, OR DIRECTORS BE LIABLE FOR DAMAGES OF ANY KIND, UNDER ANY LEGAL THEORY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE, OR INABILITY TO USE, THE PLATFORM, ANY WEBSITES LINKED TO IT, ANY CONTENT ON THE PLATFORM OR SUCH OTHER WEBSITES, INCLUDING ANY DIRECT, INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO, PERSONAL INJURY, PAIN AND SUFFERING, EMOTIONAL DISTRESS, LOSS OF REVENUE, LOSS OF PROFITS, LOSS OF BUSINESS OR ANTICIPATED SAVINGS, LOSS OF USE, LOSS OF GOODWILL, LOSS OF DATA, AND WHETHER CAUSED BY TORT (INCLUDING NEGLIGENCE), BREACH OF CONTRACT, OR OTHERWISE, EVEN IF FORESEEABLE.
              </p>
              <p>
                THE FOREGOING DOES NOT AFFECT ANY LIABILITY WHICH CANNOT BE EXCLUDED OR LIMITED UNDER APPLICABLE LAW.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">11. Indemnification</h2>
              <p>
                You agree to defend, indemnify, and hold harmless the Company, its affiliates, licensors, and service providers, and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Platform, including, but not limited to, your User Contributions, any use of the Platform's content, services, and products other than as expressly authorized in these Terms, or your use of any information obtained from the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">12. Changes to the Terms</h2>
              <p>
                We may revise and update these Terms from time to time in our sole discretion. All changes are effective immediately when we post them, and apply to all access to and use of the Platform thereafter.
              </p>
              <p>
                Your continued use of the Platform following the posting of revised Terms means that you accept and agree to the changes. You are expected to check this page frequently so you are aware of any changes, as they are binding on you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">13. Governing Law and Jurisdiction</h2>
              <p>
                These Terms and any dispute or claim arising out of or related to them, their subject matter, or their formation (in each case, including non-contractual disputes or claims) shall be governed by and construed in accordance with the laws of the State of Mississippi, without giving effect to any choice or conflict of law provision or rule.
              </p>
              <p>
                Any legal suit, action, or proceeding arising out of, or related to, these Terms or the Platform shall be instituted exclusively in the federal courts of the United States or the courts of the State of Mississippi, although we retain the right to bring any suit, action, or proceeding against you for breach of these Terms in your country of residence or any other relevant country. You waive any and all objections to the exercise of jurisdiction over you by such courts and to venue in such courts.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">14. Waiver and Severability</h2>
              <p>
                No waiver by the Company of any term or condition set out in these Terms shall be deemed a further or continuing waiver of such term or condition or a waiver of any other term or condition, and any failure of the Company to assert a right or provision under these Terms shall not constitute a waiver of such right or provision.
              </p>
              <p>
                If any provision of these Terms is held by a court or other tribunal of competent jurisdiction to be invalid, illegal, or unenforceable for any reason, such provision shall be eliminated or limited to the minimum extent such that the remaining provisions of the Terms will continue in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">15. Entire Agreement</h2>
              <p>
                The Terms, our Privacy Policy, and any terms and conditions incorporated herein constitute the sole and entire agreement between you and Experienced Results regarding the Platform and supersede all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, regarding the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">16. Contact Information</h2>
              <p>
                Questions or comments about the Platform or these Terms may be directed to our email address at jj@expresults.com or by mail to:
              </p>
              <p>
                Experienced Results<br />
                P.O. Box 1522<br />
                Escatawpa, MS 39552<br />
                United States
              </p>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}