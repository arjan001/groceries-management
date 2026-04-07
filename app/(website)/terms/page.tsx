import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Snackoh Bakers',
  description:
    'Read the terms and conditions governing the use of Snackoh Bakers website, ordering, delivery, and related services in Nairobi, Kenya.',
};

export default function TermsPage() {
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
            <span className="text-gray-700 font-medium">
              Terms and Conditions
            </span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900">
            Terms and Conditions
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
              Welcome to Snackoh Bakers. These Terms and Conditions
              (&quot;Terms&quot;) govern your use of our website, products, and
              services. By accessing our website or placing an order, you agree
              to be bound by these Terms. Please read them carefully before using
              our services.
            </p>
          </section>

          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              By accessing, browsing, or using this website, you acknowledge
              that you have read, understood, and agree to be bound by these
              Terms and our{' '}
              <Link
                href="/privacy-policy"
                className="text-orange-600 hover:underline font-semibold"
              >
                Privacy Policy
              </Link>
              . If you do not agree to these Terms, you must not use our website
              or services. We reserve the right to modify these Terms at any
              time, and your continued use of the website following any changes
              constitutes acceptance of those changes.
            </p>
          </section>

          {/* 2. Products and Services */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              2. Products and Services
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              Snackoh Bakers offers a range of freshly baked goods including, but
              not limited to, breads, cakes, pastries, cookies, doughnuts, and
              custom-made baked products. We serve both retail and wholesale
              customers in Nairobi and surrounding areas.
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                All product images on our website are for illustration purposes.
                Actual products may vary slightly in appearance.
              </li>
              <li>
                We strive to ensure all product descriptions and prices are
                accurate. However, errors may occur and we reserve the right to
                correct them.
              </li>
              <li>
                Custom cake designs are subject to consultation and may differ
                from reference images provided by the customer.
              </li>
              <li>
                Certain products may contain allergens (e.g., wheat, dairy, eggs,
                nuts). Customers with allergies should contact us before placing
                an order.
              </li>
            </ul>
          </section>

          {/* 3. Ordering and Payment */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              3. Ordering and Payment
            </h2>

            <h3 className="text-base font-bold text-gray-800 mb-2">
              3.1 Placing Orders
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm mb-4">
              Orders can be placed through our website, by phone, or via
              WhatsApp. By placing an order, you are making an offer to purchase
              the selected products. We reserve the right to accept or decline
              any order at our discretion, including due to product
              unavailability, pricing errors, or suspected fraudulent activity.
            </p>

            <h3 className="text-base font-bold text-gray-800 mb-2">
              3.2 Payment Methods
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              We accept the following payment methods:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>M-Pesa:</strong> Payment via Safaricom M-Pesa mobile
                money. You will receive a payment prompt or be provided with our
                till number or paybill details at checkout.
              </li>
              <li>
                <strong>Cash on delivery:</strong> Available for select delivery
                zones within Nairobi. The exact amount must be prepared as our
                delivery riders may not carry change.
              </li>
              <li>
                <strong>Card payments:</strong> Visa and Mastercard payments
                processed securely through our third-party payment gateway.
              </li>
              <li>
                <strong>Bank transfer:</strong> Available for wholesale and
                corporate orders upon request.
              </li>
            </ul>

            <h3 className="text-base font-bold text-gray-800 mb-2 mt-6">
              3.3 Order Confirmation
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              Once your order is placed and payment is confirmed, you will
              receive an order confirmation via SMS or email. This confirmation
              does not constitute acceptance of your order until the products
              have been dispatched or are ready for collection.
            </p>
          </section>

          {/* 4. Pricing and Availability */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              4. Pricing and Availability
            </h2>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                All prices displayed on our website are in{' '}
                <strong>Kenya Shillings (KES)</strong> and are inclusive of
                applicable taxes unless otherwise stated.
              </li>
              <li>
                Prices are subject to change without prior notice. The price
                applicable to your order is the price displayed at the time of
                order placement.
              </li>
              <li>
                Product availability is subject to stock levels. In the event
                that a product you ordered is unavailable, we will notify you and
                offer an alternative or a full refund.
              </li>
              <li>
                Wholesale pricing is available for bulk orders and may be
                negotiated separately. Please contact our sales team for
                wholesale enquiries.
              </li>
            </ul>
          </section>

          {/* 5. Delivery Policy */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              5. Delivery Policy
            </h2>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                We offer delivery services within Nairobi and surrounding areas.
                Delivery fees vary based on location and order value.
              </li>
              <li>
                <strong>Free delivery</strong> is available on orders over{' '}
                <strong>KES 2,000</strong> within select zones.
              </li>
              <li>
                Orders placed before <strong>5:00 PM</strong> are eligible for
                next-day delivery. Orders placed after 5:00 PM will be processed
                on the following business day.
              </li>
              <li>
                Custom cakes and special orders require at least{' '}
                <strong>48 hours</strong> advance notice.
              </li>
              <li>
                Delivery times are estimates and may be affected by traffic,
                weather, or other unforeseen circumstances. Snackoh Bakers shall
                not be held liable for delays beyond our control.
              </li>
              <li>
                The customer is responsible for providing an accurate delivery
                address and being available to receive the order. Failed
                deliveries due to incorrect addresses or unavailability may incur
                additional charges for re-delivery.
              </li>
            </ul>
          </section>

          {/* 6. Intellectual Property */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              6. Intellectual Property
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              All content on this website, including but not limited to text,
              graphics, logos, images, product photographs, website design, and
              software, is the property of Snackoh Bakers or its content
              suppliers and is protected by applicable intellectual property
              laws. You may not reproduce, distribute, modify, display, or use
              any content from this website without our prior written consent.
              The Snackoh Bakers name, logo, and branding are trademarks of
              Snackoh Bakers and may not be used without express permission.
            </p>
          </section>

          {/* 7. User Accounts */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              7. User Accounts
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              If you create an account on our website:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activities that occur under your
                account.
              </li>
              <li>
                You agree to provide accurate, current, and complete information
                during registration and to update your information as necessary.
              </li>
              <li>
                You must notify us immediately of any unauthorised use of your
                account.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that
                violate these Terms, provide false information, or engage in
                fraudulent activity.
              </li>
            </ul>
          </section>

          {/* 8. Limitation of Liability */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              8. Limitation of Liability
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                Snackoh Bakers provides its website and services on an &quot;as
                is&quot; and &quot;as available&quot; basis without warranties of
                any kind, either express or implied.
              </li>
              <li>
                We shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages arising from or related to
                your use of our website or services.
              </li>
              <li>
                Our total liability for any claim arising from or related to
                these Terms or our services shall not exceed the amount you paid
                for the specific order giving rise to the claim.
              </li>
              <li>
                We are not liable for any adverse reactions resulting from
                undisclosed allergies. Customers are responsible for reviewing
                product ingredients and informing us of any allergies before
                placing an order.
              </li>
            </ul>
          </section>

          {/* 9. Governing Law */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              9. Governing Law and Dispute Resolution
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              These Terms shall be governed by and construed in accordance with
              the <strong>laws of the Republic of Kenya</strong>. Any disputes
              arising out of or in connection with these Terms shall first be
              resolved through good-faith negotiation between the parties. If a
              resolution cannot be reached through negotiation, the dispute shall
              be submitted to mediation and, if necessary, to the jurisdiction of
              the courts of Kenya.
            </p>
          </section>

          {/* 10. Changes to Terms */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              10. Changes to These Terms
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              We reserve the right to update or modify these Terms at any time
              without prior notice. Changes will take effect immediately upon
              posting to this page. The &quot;Last updated&quot; date at the top
              of this page indicates when the Terms were last revised. We
              encourage you to review these Terms periodically. Your continued
              use of our website and services after any changes constitutes your
              acceptance of the revised Terms.
            </p>
          </section>

          {/* 11. Contact Information */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              11. Contact Information
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-4">
              If you have any questions or concerns about these Terms and
              Conditions, please contact us:
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

          {/* Divider */}
          <hr className="border-gray-100" />

          {/* Related Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/privacy-policy"
              className="text-sm text-orange-600 hover:underline font-semibold"
            >
              Privacy Policy
            </Link>
            <span className="hidden sm:inline text-gray-300">|</span>
            <Link
              href="/refund-policy"
              className="text-sm text-orange-600 hover:underline font-semibold"
            >
              Refund Policy
            </Link>
          </div>

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
