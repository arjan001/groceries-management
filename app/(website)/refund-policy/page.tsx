import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy | Snackoh Bakers',
  description:
    'Understand the refund, return, exchange, and cancellation policies for orders placed with Snackoh Bakers in Nairobi, Kenya.',
};

export default function RefundPolicyPage() {
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
            <span className="text-gray-700 font-medium">Refund Policy</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900">
            Refund Policy
          </h1>
          <p className="text-gray-500 mt-3 text-sm">
            Last updated: 1 March 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 space-y-10">
          {/* Overview */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              1. Overview
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              At Snackoh Bakers, we take great pride in the quality of our baked
              goods and strive to ensure every customer is satisfied with their
              order. We understand, however, that issues may arise from time to
              time. This Refund Policy outlines the circumstances under which
              refunds, exchanges, or replacements may be issued for products
              purchased from Snackoh Bakers. By placing an order with us, you
              agree to the terms of this policy.
            </p>
          </section>

          {/* 2. Eligibility for Refunds */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              2. Eligibility for Refunds
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              You may be eligible for a refund in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>Quality issues:</strong> If you receive a product that
                is stale, spoiled, undercooked, or does not meet our standard
                quality expectations, you may request a refund or replacement
                within <strong>2 hours</strong> of delivery or collection.
              </li>
              <li>
                <strong>Incorrect order:</strong> If you receive the wrong
                product(s), a different quantity, or items not matching your
                confirmed order, you are eligible for a full refund or
                replacement.
              </li>
              <li>
                <strong>Missing items:</strong> If your order arrives with
                missing items, we will refund the value of the missing items or
                arrange for prompt delivery of the missing products.
              </li>
              <li>
                <strong>Order not delivered:</strong> If your order is confirmed
                but never delivered and we are unable to resolve the delivery
                issue, you will receive a full refund.
              </li>
            </ul>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mt-4">
              <p className="text-sm text-orange-800 font-medium">
                Important: Due to the perishable nature of baked goods, all
                refund requests must be made within{' '}
                <strong>2 hours of delivery</strong>. Requests made after this
                window may not be honoured.
              </p>
            </div>
          </section>

          {/* 3. Non-Refundable Items */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              3. Non-Refundable Items
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              The following items are not eligible for refunds unless they arrive
              damaged or materially different from what was ordered:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>Custom cakes and special orders:</strong> Cakes and
                products made to your specific design, flavour, or dietary
                requirements are non-refundable once production has commenced.
                This includes birthday cakes, wedding cakes, celebration cakes,
                and any customised baked goods.
              </li>
              <li>
                <strong>Perishable goods after delivery:</strong> Products that
                have been accepted at delivery and consumed or stored
                improperly. We cannot issue refunds for items that have
                deteriorated due to the customer&apos;s handling or storage after
                delivery.
              </li>
              <li>
                <strong>Products consumed or partially consumed:</strong> Items
                that have been eaten or significantly consumed before a complaint
                is raised.
              </li>
              <li>
                <strong>Change of mind:</strong> We do not offer refunds for
                orders where you have simply changed your mind about the
                purchase, unless the order is cancelled before production (see
                Section 8).
              </li>
            </ul>
          </section>

          {/* 4. How to Request a Refund */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              4. How to Request a Refund
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              To request a refund, please follow these steps:
            </p>
            <ol className="list-decimal list-inside text-gray-600 text-sm space-y-3 ml-2">
              <li>
                <strong>Contact us promptly</strong> &mdash; Reach out to our
                customer service team within 2 hours of receiving your order via
                phone, WhatsApp, or email. Visit our{' '}
                <Link
                  href="/contact"
                  className="text-orange-600 hover:underline font-semibold"
                >
                  Contact Us
                </Link>{' '}
                page for current contact details.
              </li>
              <li>
                <strong>Provide your order details</strong> &mdash; Include your
                order number, the product(s) in question, and a clear
                description of the issue.
              </li>
              <li>
                <strong>Share photographic evidence</strong> &mdash; For quality
                issues, incorrect orders, or damaged items, please provide clear
                photographs of the product(s) received. This helps us
                investigate and resolve the matter efficiently.
              </li>
              <li>
                <strong>Await our response</strong> &mdash; Our team will review
                your request and respond within <strong>24 hours</strong>. We
                may ask for additional information if needed.
              </li>
            </ol>
          </section>

          {/* 5. Refund Processing */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              5. Refund Processing
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              Once your refund request has been approved, the refund will be
              processed as follows:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>M-Pesa payments:</strong> Refunds will be processed as
                an M-Pesa reversal or direct transfer to the phone number used
                for payment within <strong>1&ndash;3 business days</strong>.
              </li>
              <li>
                <strong>Card payments:</strong> Refunds will be credited back to
                the original card used for payment within{' '}
                <strong>5&ndash;10 business days</strong>, depending on your
                bank&apos;s processing times.
              </li>
              <li>
                <strong>Bank transfer:</strong> For orders paid via bank
                transfer, refunds will be sent to the originating bank account
                within <strong>3&ndash;5 business days</strong>.
              </li>
              <li>
                <strong>Cash payments:</strong> Refunds for cash-on-delivery
                orders will be processed via M-Pesa to a phone number you
                provide, or as store credit for future orders.
              </li>
            </ul>
            <p className="text-gray-600 leading-relaxed text-sm mt-3">
              You will receive a notification (via SMS or email) once the refund
              has been initiated. Please allow the stated processing time before
              following up.
            </p>
          </section>

          {/* 6. Exchanges */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              6. Exchanges
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              If you received an incorrect or defective product, we will gladly
              exchange it for the correct item at no additional cost, subject to
              availability. Exchanges must be requested within{' '}
              <strong>2 hours of delivery</strong>. If the originally ordered
              product is no longer available, we will offer a suitable
              alternative or issue a full refund. For custom orders, exchanges
              may not be possible due to the bespoke nature of the product; a
              partial or full refund may be issued instead at our discretion.
            </p>
          </section>

          {/* 7. Damaged or Incorrect Orders */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              7. Damaged or Incorrect Orders
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              We take every precaution to ensure your order is properly packaged
              and handled during delivery. If your order arrives damaged:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                Please inspect your order upon delivery and report any damage
                immediately to the delivery rider and our customer service team.
              </li>
              <li>
                Take photographs of the damaged product(s) and the packaging
                before disturbing or discarding them.
              </li>
              <li>
                We will arrange for a replacement to be delivered to you as soon
                as possible, or issue a full refund if replacement is not
                feasible.
              </li>
              <li>
                Damage caused by the customer after delivery acceptance (e.g.,
                dropping the product) is not eligible for a refund or
                replacement.
              </li>
            </ul>
          </section>

          {/* 8. Cancellation Policy */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              8. Cancellation Policy
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-3">
              You may cancel your order under the following conditions:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1.5 ml-2">
              <li>
                <strong>Standard orders:</strong> Cancellations made within{' '}
                <strong>30 minutes</strong> of placing the order will receive a
                full refund, provided production has not yet started.
              </li>
              <li>
                <strong>Custom cakes and special orders:</strong> Cancellations
                must be made at least <strong>24 hours</strong> before the
                scheduled delivery date to receive a full refund. Cancellations
                made less than 24 hours before delivery may incur a cancellation
                fee of up to <strong>50%</strong> of the order value to cover
                ingredients and labour already expended.
              </li>
              <li>
                <strong>Orders already in transit:</strong> Orders that have
                already been dispatched for delivery cannot be cancelled. You may
                refuse delivery, but refund eligibility will be assessed on a
                case-by-case basis.
              </li>
            </ul>
            <p className="text-gray-600 leading-relaxed text-sm mt-3">
              To cancel an order, please contact our customer service team
              immediately with your order number.
            </p>
          </section>

          {/* 9. Contact Information */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">
              9. Contact Information
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm mb-4">
              For any refund requests, complaints, or questions about this
              policy, please do not hesitate to reach out to us:
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
              href="/terms"
              className="text-sm text-orange-600 hover:underline font-semibold"
            >
              Terms and Conditions
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
