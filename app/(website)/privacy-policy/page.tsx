import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Snackoh Bakers',
  description:
    'Learn how Snackoh Bakers collects, uses, and protects your personal information in compliance with the Kenya Data Protection Act 2019.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b-4 border-orange-600">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link href="/" className="hover:text-orange-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">Privacy Policy</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900">
            Privacy Policy
          </h1>
          <p className="text-gray-500 mt-3 text-sm">
            Last updated: 1 March 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 space-y-10">
          {/* Introduction */}
          <section>
            <p className="text-gray-600 leading-relaxed text-sm">
              Snackoh Bakers (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
              is committed to protecting and respecting your privacy. This
              Privacy Policy explains how we collect, use, disclose, and
              safeguard your personal information when you visit our website,
              place orders, or interact with our services. This policy is
              prepared in accordance with the{' '}
              <strong>Kenya Data Protection Act, 2019</strong> and the
              guidelines issued by the{' '}
              <strong>
                Office of the Data Protection Commissioner (ODPC)
              </strong>
              .
            </p>
            <p className="text-gray-600 leading-relaxed text-sm mt-4">
              By using our website and services, you agree to the collection and
              use of information in accordance with this policy. If you do not
              agree with any part of this policy, please refrain from using our
              services.
            </p>
          </section>

          {/* 1. Information We Collect */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              1. Information We Collect
            </h2>

            <h3 className="text-base font-bold text-gray-800 mb-2">
              1.1 Personal Data
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              When you place an order, create an account, subscribe to our
              newsletter, or contact us, we may collect the following personal
              information:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Delivery address</li>
              <li>
                Payment information (M-Pesa phone number, card details processed
                via secure third-party payment gateways)
              </li>
              <li>Order history and preferences</li>
            </ul>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-6">
              1.2 Usage Data
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              We automatically collect certain information when you visit our
              website, including:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>IP address and approximate geographic location</li>
              <li>Browser type, version, and language</li>
              <li>Device type and operating system</li>
              <li>Pages visited, time spent on pages, and navigation paths</li>
              <li>Referring website or source</li>
            </ul>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-6">
              1.3 Cookies and Similar Technologies
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              We use cookies and similar tracking technologies to enhance your
              browsing experience, remember your preferences, and analyse site
              traffic. For more details, see Section 6 below.
            </p>
          </section>

          {/* 2. How We Use Your Information */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>Processing orders:</strong> To process, fulfil, and
                deliver your orders, including sending order confirmations and
                delivery updates.
              </li>
              <li>
                <strong>Customer service:</strong> To respond to your enquiries,
                feedback, complaints, and support requests.
              </li>
              <li>
                <strong>Communication:</strong> To send you marketing
                communications, newsletters, promotions, and updates about new
                products (only with your consent, which you may withdraw at any
                time).
              </li>
              <li>
                <strong>Improvement:</strong> To analyse usage patterns and
                improve our website, products, and services.
              </li>
              <li>
                <strong>Security:</strong> To detect and prevent fraud,
                unauthorised access, and other security threats.
              </li>
              <li>
                <strong>Legal compliance:</strong> To comply with applicable
                laws, regulations, and legal processes.
              </li>
            </ul>
          </section>

          {/* 3. Data Sharing and Disclosure */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              3. Data Sharing and Disclosure
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              We do not sell, rent, or trade your personal information to third
              parties. We may share your data only in the following
              circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>Service providers:</strong> With trusted third-party
                service providers who assist us in operating our website,
                processing payments (e.g., M-Pesa, card payment processors), and
                delivering orders. These providers are contractually obligated to
                protect your data.
              </li>
              <li>
                <strong>Delivery partners:</strong> With our delivery personnel
                and logistics partners, limited to the information necessary to
                complete your delivery (name, phone number, and delivery
                address).
              </li>
              <li>
                <strong>Legal obligations:</strong> When required by law, court
                order, or government authority, or to protect our rights, safety,
                or property.
              </li>
              <li>
                <strong>Business transfers:</strong> In connection with a merger,
                acquisition, or sale of assets, your information may be
                transferred as part of that transaction.
              </li>
            </ul>
          </section>

          {/* 4. Data Security */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              4. Data Security
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              We implement appropriate technical and organisational measures to
              protect your personal data against unauthorised access, alteration,
              disclosure, or destruction. These measures include encrypted data
              transmission (SSL/TLS), secure server infrastructure, access
              controls, and regular security assessments. However, no method of
              transmission over the internet is 100% secure, and we cannot
              guarantee absolute security.
            </p>
          </section>

          {/* 5. Data Retention */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              5. Data Retention
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              We retain your personal data only for as long as necessary to
              fulfil the purposes for which it was collected, or as required by
              applicable law. Order records may be retained for up to seven (7)
              years for tax and accounting purposes. You may request deletion of
              your personal data at any time, subject to legal retention
              requirements.
            </p>
          </section>

          {/* 6. Cookies and Tracking Technologies */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              6. Cookies and Tracking Technologies
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              Our website uses cookies to:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>Essential cookies:</strong> Ensure the website functions
                correctly (e.g., shopping cart, user sessions).
              </li>
              <li>
                <strong>Analytics cookies:</strong> Help us understand how
                visitors use our website so we can improve it.
              </li>
              <li>
                <strong>Preference cookies:</strong> Remember your settings and
                preferences for a better experience.
              </li>
              <li>
                <strong>Marketing cookies:</strong> Deliver relevant
                advertisements and measure their effectiveness.
              </li>
            </ul>
            <p className="text-gray-600 leading-relaxed text-sm mt-3">
              You can manage or disable cookies through your browser settings.
              Please note that disabling certain cookies may affect the
              functionality of our website.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              7. Your Rights Under the Kenya Data Protection Act 2019
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              Under the Data Protection Act, 2019 of Kenya, you have the
              following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>Right of access:</strong> You may request a copy of the
                personal data we hold about you.
              </li>
              <li>
                <strong>Right to rectification:</strong> You may request
                correction of inaccurate or incomplete personal data.
              </li>
              <li>
                <strong>Right to erasure:</strong> You may request deletion of
                your personal data, subject to legal retention requirements.
              </li>
              <li>
                <strong>Right to restrict processing:</strong> You may request
                that we limit the processing of your personal data in certain
                circumstances.
              </li>
              <li>
                <strong>Right to data portability:</strong> You may request a
                copy of your data in a commonly used, machine-readable format.
              </li>
              <li>
                <strong>Right to object:</strong> You may object to the
                processing of your personal data for direct marketing purposes at
                any time.
              </li>
              <li>
                <strong>Right to withdraw consent:</strong> Where processing is
                based on consent, you may withdraw your consent at any time
                without affecting the lawfulness of prior processing.
              </li>
            </ul>
            <p className="text-gray-600 leading-relaxed text-sm mt-3">
              To exercise any of these rights, please contact us using the
              details provided in Section 10 below.
            </p>
          </section>

          {/* 8. Children's Privacy */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              8. Children&apos;s Privacy
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              Our website and services are not directed at children under the age
              of 18. We do not knowingly collect personal information from
              children. If you are a parent or guardian and believe your child
              has provided us with personal data, please contact us immediately
              and we will take steps to remove such information from our systems.
            </p>
          </section>

          {/* 9. Changes to This Policy */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              9. Changes to This Privacy Policy
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              We may update this Privacy Policy from time to time to reflect
              changes in our practices, technology, legal requirements, or other
              factors. When we make changes, we will update the &quot;Last
              updated&quot; date at the top of this page. We encourage you to
              review this policy periodically. Continued use of our website and
              services after any changes constitutes your acceptance of the
              updated policy.
            </p>
          </section>

          {/* 10. Contact Information */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              10. Contact Information
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-4">
              If you have any questions, concerns, or requests regarding this
              Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 space-y-1.5">
              <p className="font-bold text-gray-900">Snackoh Bakers</p>
              <p>Nairobi, Kenya</p>
              <p>
                For up-to-date contact details, please refer to the business
                contact information available in your admin dashboard under{' '}
                <strong>Settings &gt; General</strong>, or visit our{' '}
                <Link
                  href="/contact"
                  className="text-orange-600 hover:underline font-semibold"
                >
                  Contact Us
                </Link>{' '}
                page.
              </p>
            </div>
          </section>

          {/* 11. ODPC */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              11. Office of the Data Protection Commissioner (ODPC)
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              If you believe that your data protection rights have been violated,
              you have the right to lodge a complaint with the Office of the Data
              Protection Commissioner (ODPC) of Kenya:
            </p>
            <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 space-y-1.5">
              <p className="font-bold text-gray-900">
                Office of the Data Protection Commissioner
              </p>
              <p>Nairobi, Kenya</p>
              <p>
                Website:{' '}
                <a
                  href="https://www.odpc.go.ke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:underline font-semibold"
                >
                  www.odpc.go.ke
                </a>
              </p>
            </div>
          </section>

          {/* Divider */}
          <hr className="border-gray-100" />

          {/* Back to Home */}
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold text-sm rounded-full hover:bg-gray-800 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
