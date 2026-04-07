import Link from 'next/link';

export default function CookiePolicyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-transparent" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
          <p className="text-xs text-orange-400 font-bold tracking-widest uppercase mb-2">
            Legal
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Cookie Policy</h1>
          <p className="text-white/70 text-base max-w-lg mx-auto">
            Learn about how Snackoh Bakers uses cookies and similar technologies on our website.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          {/* Last updated */}
          <div className="mb-10 pb-6 border-b border-gray-100">
            <p className="text-sm text-gray-400">
              Last updated: <span className="text-gray-600 font-medium">1 March 2026</span>
            </p>
          </div>

          {/* Introduction */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-7 bg-orange-600 rounded-full inline-block" />
              What Are Cookies?
            </h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                Cookies are small text files that are placed on your computer or mobile device when
                you visit a website. They are widely used to make websites work more efficiently, as
                well as to provide information to the owners of the site.
              </p>
              <p>
                Cookies allow a website to recognise your device and remember information about your
                visit, such as your preferred language, login details, and other settings. This can
                make your next visit easier and the site more useful to you.
              </p>
              <p>
                At Snackoh Bakers, we use cookies to enhance your browsing experience, understand
                how our website is used, and deliver content and advertisements that are relevant to
                you.
              </p>
            </div>
          </div>

          {/* Types of Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1 h-7 bg-orange-600 rounded-full inline-block" />
              Types of Cookies We Use
            </h2>

            <div className="space-y-6">
              {/* Necessary */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-green-600"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Necessary Cookies</h3>
                    <span className="text-[10px] text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded-full">
                      Always active
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  These cookies are essential for the website to function properly. They enable core
                  functionality such as page navigation, access to secure areas, and shopping cart
                  functionality. The website cannot function properly without these cookies, and they
                  cannot be disabled.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  <p className="font-semibold text-gray-500 mb-1">Examples:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Session management cookies</li>
                    <li>Shopping cart cookies</li>
                    <li>Security and authentication cookies</li>
                    <li>Cookie consent preferences</li>
                  </ul>
                </div>
              </div>

              {/* Analytics */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-600"
                    >
                      <line x1="18" x2="18" y1="20" y2="10" />
                      <line x1="12" x2="12" y1="20" y2="4" />
                      <line x1="6" x2="6" y1="20" y2="14" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900">Analytics Cookies</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Analytics cookies help us understand how visitors interact with our website by
                  collecting and reporting information anonymously. This data helps us improve the
                  structure and content of our website to provide you with a better experience.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  <p className="font-semibold text-gray-500 mb-1">Examples:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Number of visitors and page views</li>
                    <li>Time spent on each page</li>
                    <li>Traffic sources and referral information</li>
                    <li>Browser and device information</li>
                  </ul>
                </div>
              </div>

              {/* Marketing */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-orange-600"
                    >
                      <path d="m3 11 18-5v12L3 13v-2z" />
                      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900">Marketing Cookies</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Marketing cookies are used to track visitors across websites. The intention is to
                  display ads that are relevant and engaging for the individual user. These cookies
                  may be set by us or by third-party advertising partners.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  <p className="font-semibold text-gray-500 mb-1">Examples:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Social media tracking pixels</li>
                    <li>Advertising platform cookies</li>
                    <li>Retargeting and remarketing cookies</li>
                    <li>Conversion tracking cookies</li>
                  </ul>
                </div>
              </div>

              {/* Personalization */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-purple-600"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      <path d="M5 3v4" />
                      <path d="M19 17v4" />
                      <path d="M3 5h4" />
                      <path d="M17 19h4" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900">Personalization Cookies</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Personalization cookies allow the website to remember choices you make (such as
                  your language, region, or display preferences) and provide enhanced, more
                  personalised features. They may also be used to provide you with tailored product
                  recommendations.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  <p className="font-semibold text-gray-500 mb-1">Examples:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Language and region preferences</li>
                    <li>Display settings (e.g., layout, font size)</li>
                    <li>Product recommendation preferences</li>
                    <li>Recently viewed items</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* How to Control Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-7 bg-orange-600 rounded-full inline-block" />
              How to Control Cookies
            </h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                You have the right to decide whether to accept or reject cookies. When you first
                visit our website, a cookie consent banner will appear allowing you to accept all
                cookies or manage your preferences for each cookie category.
              </p>
              <p>
                You can also control cookies through your browser settings. Most web browsers allow
                you to manage your cookie preferences. You can set your browser to refuse cookies,
                delete certain cookies, or alert you when a cookie is being set. Please note that if
                you disable cookies, some parts of our website may not function properly.
              </p>
              <div className="bg-gray-50 rounded-xl p-5 mt-4">
                <p className="font-semibold text-gray-700 mb-2 text-sm">Browser cookie settings:</p>
                <ul className="space-y-2">
                  <li>
                    <strong className="text-gray-700">Google Chrome:</strong> Settings &gt; Privacy
                    and Security &gt; Cookies and other site data
                  </li>
                  <li>
                    <strong className="text-gray-700">Mozilla Firefox:</strong> Settings &gt; Privacy
                    &amp; Security &gt; Cookies and Site Data
                  </li>
                  <li>
                    <strong className="text-gray-700">Safari:</strong> Preferences &gt; Privacy &gt;
                    Manage Website Data
                  </li>
                  <li>
                    <strong className="text-gray-700">Microsoft Edge:</strong> Settings &gt; Cookies
                    and site permissions &gt; Manage and delete cookies
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Third-Party Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-7 bg-orange-600 rounded-full inline-block" />
              Third-Party Cookies
            </h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                In addition to our own cookies, we may also use various third-party cookies to
                report usage statistics of the website, deliver advertisements, and so on. These
                cookies are governed by the respective privacy policies of the third parties.
              </p>
              <p>
                Third-party services we may use include:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  <strong className="text-gray-700">Google Analytics</strong> — for website usage
                  analytics and performance monitoring
                </li>
                <li>
                  <strong className="text-gray-700">Meta (Facebook) Pixel</strong> — for advertising
                  measurement and audience targeting
                </li>
                <li>
                  <strong className="text-gray-700">Supabase</strong> — for authentication and
                  session management
                </li>
                <li>
                  <strong className="text-gray-700">Vercel Analytics</strong> — for web performance
                  monitoring and insights
                </li>
              </ul>
              <p>
                We encourage you to review the privacy policies of these third-party services to
                understand how they use cookies and your data.
              </p>
            </div>
          </div>

          {/* Data Protection Act */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-7 bg-orange-600 rounded-full inline-block" />
              Kenya&apos;s Data Protection Act 2019
            </h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                Snackoh Bakers is committed to complying with the Kenya Data Protection Act, 2019,
                and the regulations issued by the Office of the Data Protection Commissioner (ODPC).
                Under this Act, we are required to:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>Obtain your informed consent before collecting personal data through cookies</li>
                <li>Clearly explain the purpose for which data is collected</li>
                <li>Ensure the security and confidentiality of your personal data</li>
                <li>Allow you to access, correct, or request deletion of your personal data</li>
                <li>Not use your data for purposes other than those stated</li>
              </ul>
              <p>
                As a data subject under the Act, you have the right to be informed about the
                collection and use of your personal data, the right to access your data, the right
                to object to processing, and the right to have your data deleted. We process your
                data lawfully, fairly, and in a transparent manner.
              </p>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 mt-4">
                <p className="font-semibold text-gray-800 mb-1 text-sm">ODPC Registration</p>
                <p className="text-sm text-gray-600">
                  Snackoh Bakers is registered with the Office of the Data Protection Commissioner
                  (ODPC) in compliance with Kenya&apos;s Data Protection Act, 2019. For more
                  information about data protection in Kenya, visit the{' '}
                  <a
                    href="https://www.odpc.go.ke"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 font-medium underline hover:text-orange-700 transition-colors"
                  >
                    ODPC website
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Changes to this Policy */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-7 bg-orange-600 rounded-full inline-block" />
              Changes to This Policy
            </h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                We may update this Cookie Policy from time to time to reflect changes in technology,
                legislation, or our data practices. When we make changes, we will update the
                &quot;Last updated&quot; date at the top of this page. We encourage you to review
                this policy periodically to stay informed about how we use cookies.
              </p>
            </div>
          </div>

          {/* Contact Information */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-7 bg-orange-600 rounded-full inline-block" />
              Contact Us
            </h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                If you have any questions about this Cookie Policy, your personal data, or wish to
                exercise your data protection rights, please contact us:
              </p>
              <div className="bg-gray-50 rounded-xl p-5 space-y-2">
                <p>
                  <strong className="text-gray-700">Snackoh Bakers</strong>
                </p>
                <p>Nairobi, Kenya</p>
                <p>
                  Email:{' '}
                  <a
                    href="mailto:sales@snackoh-bakers.com"
                    className="text-orange-600 hover:underline"
                  >
                    sales@snackoh-bakers.com
                  </a>
                </p>
                <p>
                  Phone:{' '}
                  <a href="tel:0733675267" className="text-orange-600 hover:underline">
                    0733 67 52 67
                  </a>
                </p>
                <p>
                  Feedback:{' '}
                  <a href="tel:0722587222" className="text-orange-600 hover:underline">
                    0722 587 222
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Back link */}
          <div className="pt-6 border-t border-gray-100 flex flex-wrap gap-4">
            <Link
              href="/"
              className="px-6 py-3 bg-gray-900 text-white font-bold text-sm rounded-full hover:bg-gray-800 transition-colors"
            >
              Back to Home
            </Link>
            <Link
              href="/shop"
              className="px-6 py-3 border-2 border-gray-200 text-gray-800 font-bold text-sm rounded-full hover:border-orange-400 hover:text-orange-600 transition-colors"
            >
              Browse Our Shop
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
