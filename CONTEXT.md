# Syncing Travel Portal

This context describes the public travel portal language used to present Syncing Travel's China trip products and inquiry flow.

## Language

**China Trips**:
The top-level product entry that groups destinations, ready-made tour routes, and custom trip planning.
_Avoid_: Products, Tours only, Destinations only

**Featured Services**:
A public content section that presents Syncing Travel's service strengths, planning support, and travel guide value.
_Avoid_: Travel Guide as a top-level navigation label

**Home Brand Message**:
The first full content section below the hero that concisely explains what Syncing Travel does for overseas travelers.
_Avoid_: Putting the explanation into the hero, long company introductions, overloaded copy

**Real Moments**:
A home section that combines real travel photography and traveler story content to show lived trip experience.
_Avoid_: Generic stock-gallery positioning

**Traveler Notes**:
Short foreign traveler impressions for route-covered destinations, shown as content-only story cards on the public site.
_Avoid_: Fake reviews, unverified customer claims, copied full review screenshots, visible third-party source labels on cards

**Why Choose Us**:
A home section that communicates Syncing Travel's core advantages through local team knowledge, flexible planning, real route resources, and on-trip support.
_Avoid_: Generic claims such as professional, high quality, or best service without concrete support

**Inquiry / Lead**:
Any user-facing form submission that asks Syncing Travel to follow up.

**Quick Contact**:
A lightweight inquiry from the contact page.

**Contact Us CTA**:
A top navigation contact label that routes visitors to the **Custom Trip Request** page.
_Avoid_: Showing email as the primary top navigation contact affordance

**Search Entry**:
A compact top navigation search affordance for finding routes, destinations, and planning content.
_Avoid_: A full-width desktop search input in the primary navigation

**Custom Trip Request**:
A richer inquiry for private China trip planning.

**Route-based private inquiry / 路线私人定制**:
A short inquiry started from a selected **English Route Product**. The traveler keeps that route as the base plan and only shares dates, group size, contact details, optional change notes, and preference fields Admin marks for the route-private short form (`type: route_private`).
_Avoid_: Sending travelers into the blank **Custom Trip Request** form when they already chose a route; mixing this with guaranteed **Group Tour Booking (fixed departure)** checkout

**Mobile China Trips Mini-App**:
The mobile presentation of **China Trips** as an app-like product flow inside the website, helping travelers browse, choose a route style, submit trip information, and buy guaranteed fixed-departure group tour seats through hosted card checkout.
_Avoid_: Treating it as a normal long webpage, forcing account creation before browsing or payment, or using vague request/deposit language for online-sellable fixed departures

**Email Lead Capture**:
A low-friction identity step where the traveler provides an email to continue an inquiry or payment-intent flow, without requiring a full account registration first.
_Avoid_: Full login walls before browsing or before basic trip information is collected

**Custom trip inquiry / 定制询盘**:
A non-payment inquiry path for travelers interested in a route or trip style that is not yet online-sellable, not guaranteed, or missing core transaction information.
_Avoid_: Mixing inquiry language into fixed-departure products that are available for full online booking

**Payment Intent / Invoice Preview**:
A pre-payment step for inquiry or manual follow-up flows that shows a payable plan, amount, or bill-like summary without completing an online booking.
_Avoid_: Using this model for guaranteed fixed-departure group tour seats that are intended to be fully purchased online

**Hosted Card Payment**:
The real-payment step where travelers pay by credit card through a trusted payment provider such as Stripe Checkout or Stripe Elements, rather than Syncing Travel collecting raw card numbers directly.
_Avoid_: Building a custom credit-card form that stores or directly handles card numbers

**Group Tour Booking (fixed departure)**:
A guaranteed group tour route date that can be purchased online at a fixed adult price, with backend inventory enforcement, full USD payment, and immediate order confirmation after trusted Stripe webhook success.
_Avoid_: Deposit-only language, final price TBC, minimum-group uncertainty, forced pre-payment account creation, or payment buttons when core transaction information is incomplete

**Lead Follow-Up**:
The operational work after an inquiry is received.

**Response Promise**:
The public commitment that Syncing Travel will review an inquiry and reply within 24 hours.

**Primary Navigation**:
The public site's top-level navigation labels: **Home**, **China Trips**, **Featured Services**, and **About**.
_Avoid_: Exposing Destinations, Tours, Custom Trip Planning, Travel Guide, Cost, or Contact as separate top-level labels

**Raw Intake Folder**:
A temporary holding folder for original route, brand, and media files before extraction, cleaning, and review.
_Avoid_: Data source, publish-ready data, final content library

**Structured Travel Data**:
The reviewed route, destination, and asset records that the public portal may consume as the trusted content layer.
_Avoid_: Auto-published extraction output, unreviewed scraped data

**English Route Product**:
A route product record whose publishable title, summary, duration, destination coverage, and customer-facing fields are available in English.
_Avoid_: Chinese-only published route record

**Traveler-Friendly Rewrite**:
A light English rewrite that preserves route facts while making titles, summaries, highlights, and pacing easier for overseas travelers to understand.
_Avoid_: Literal machine translation, invented selling points, changed route facts

**Internal Source Trace**:
A non-customer-facing reference to the raw document or webpage used to extract and verify a route, destination, or media record.
_Avoid_: Showing source file names, local paths, or raw URLs to travelers

**Route Product Type**:
The traveler-facing selling mode for an **English Route Product**, such as private, group-tour, customizable, or fixed-departure.
_Avoid_: Hiding the selling mode inside descriptive copy

**Primary Route Product Type**:
The main selling mode used to position an **English Route Product** when multiple product types are available.
_Avoid_: Treating all available product types as equally important on product cards

**Extraction Draft**:
An automatically generated intermediate record created from raw files before human review.
_Avoid_: Trusted data, final route data

**Media Resource Library**:
The organized image and video asset library available for product pages, destination pages, and marketing sections.
_Avoid_: Untracked media dump, raw-folder hotlinking

## Relationships

- **China Trips** contains destination discovery, route browsing, and custom trip planning entry points.
- **China Trips** keeps a desktop product-center presentation for PC customers and a mobile app-like discovery presentation for mobile customers.
- **Featured Services** is a top-level navigation entry alongside **China Trips** and **About**.
- **Primary Navigation** stays concise by grouping destinations, route browsing, and custom planning under **China Trips**.
- On desktop, **China Trips** may expose a dropdown product menu. On mobile, tapping **China Trips** should enter the product page directly instead of opening a dense nested menu.
- The `/china-trips` route is the canonical **China Trips** page for both desktop and mobile; mobile should adapt the same route into an app-like product browsing experience rather than using a separate route.
- A future standalone or subdomain-style **China Trips** experience may be considered later, but the current phase should keep the existing route and prioritize the mobile experience.
- Mobile **China Trips** may use a sticky bottom product tab with **Destinations**, **Tours**, **Custom Trip**, and **Search**. It should not include account-oriented entries such as Profile.
- Mobile **China Trips** category chips should stay product-focused, such as **All**, **Destinations**, **Tours**, and **Custom Trip**. Travel tips or guide content belongs under **Featured Services**, not **China Trips**.
- Mobile **China Trips** category chips should support simple browsing and section jumps, not complex filtering.
- Mobile **China Trips** should use an app-like product-card hero, while the desktop China Trips presentation can remain PC-oriented.
- **Mobile China Trips Mini-App** is the current-phase target for mobile **China Trips**: it should feel like a guided product flow, not a generic webpage.
- Mobile **China Trips** should highlight Beijing, Zhangjiajie, Guilin, and Shanghai as the first visible popular destinations.
- Mobile **China Trips** should show only two compact curated route cards near the top, with a **View all** path for the full route list.
- Mobile **China Trips** route cards should avoid fixed prices unless confirmed; use private quote language for variable custom travel pricing.
- Mobile **China Trips** should place a concise **Design Your Own Journey** custom planning card after the initial curated route cards.
- Mobile **China Trips** may include short trust points, but they must avoid repeating homepage claims or creating information overload.
- Mobile **China Trips** should combine the product-facing roles of **Destinations**, **Tours**, and **Custom Trip**. It should not include **Real Moments** content from the homepage.
- Mobile **China Trips** should help travelers continue by preference rather than date, using travel styles such as **First Time in China**, **Nature & Scenery**, **Culture & Heritage**, and **Family & Easy Pace**.
- Mobile **China Trips** travel style cards should route travelers toward the **Custom Trip Request** form, optionally carrying the selected style as context.
- Mobile **China Trips** search should submit to the existing site search route rather than creating complex in-page filtering.
- **Mobile China Trips Mini-App** social-tour booking currently uses **confirm → email inquiry** (`group_tour_inquiry`) instead of Stripe Checkout; Stripe/checkout APIs remain in the codebase for a later restore. Account creation should not block submitting that request.
- **Mobile China Trips Mini-App** may still include a **Custom trip inquiry** flow for non-guaranteed, custom, incomplete, or not-yet-online-sellable departures.
- **Payment Intent / Invoice Preview** belongs to inquiry or manual follow-up flows, not to the temporary email-confirm social-tour path.
- **Group Tour Booking (fixed departure)** online Stripe purchase remains the intended long-term model (guaranteed departure, fixed adult price, full USD payment, inventory enforcement, webhook-confirmed order). **Temporarily (2026-07)**, traveler UI hides payment and submits a confirm-by-email inquiry instead; do not delete Stripe paths when editing the Mini-App.
- **Booking confirmation** for live Stripe orders still has two entry points: Stripe success returns travelers **inside** the Mini-App `Booking confirmed` view (`/china-trips?checkout=success`), while the confirmation email keeps linking to the **durable order page** (`/orders/{orderNumber}?token=...`). The temporary email-confirm path shows an in-app “Request received” state instead of payment confirmation.
- Foreign travelers may expect to pay by credit card later; when payment returns, credit-card entry belongs in trusted hosted payment flow, not inside a custom Syncing form.
- **Custom Trip Request** should remain a prominent call to action inside the desktop **China Trips** dropdown rather than a separate top-level navigation label.
- **Featured Services** should navigate directly to `/featured-services` from the top navigation, without a dropdown.
- **Contact Us CTA** should appear as `Contact Us` in the top navigation and route to `/custom-trip`, not to a separate contact page or mailto link.
- **Search Entry** should stay compact in the top navigation, such as an icon button that opens the site search.
- **Structured Travel Data** is the only trusted structured source for route, destination, and asset records; files in a **Raw Intake Folder** must become an **Extraction Draft** and pass review before they become **Structured Travel Data**.
- A route record in **Structured Travel Data** must be an **English Route Product**; when the available route material is Chinese-only, the cleaned product data must be translated into English before publishing.
- An **English Route Product** should use a **Traveler-Friendly Rewrite** for customer-facing English copy while preserving factual details such as duration, destinations, attractions, inclusions, exclusions, group type, and price conditions.
- An **English Route Product** must declare its **Route Product Type** so travelers can distinguish private trips, group tours, customizable routes, and fixed-departure products before inquiring.
- An **English Route Product** may have multiple available **Route Product Type** values, but it must have exactly one **Primary Route Product Type** for card positioning and search filtering.
- **English Route Products** are extracted from route documents or route web pages, not manually invented from file names alone.
- An **Internal Source Trace** is required for review and maintenance, but it is not displayed on traveler-facing route pages.
- Images and videos from a **Raw Intake Folder** may enter the **Media Resource Library** directly after organization, but they still need stable names, source tracking, and intended-use metadata.
- Mobile primary navigation should show only **Home**, **China Trips**, **Featured Services**, **About**, **Contact Us**, and a compact **Search Entry**. It should not expand destination submenus in the drawer.
- Desktop **China Trips** dropdown should highlight six recognizable destinations: Beijing, Shanghai, Xi'an, Chengdu, Zhangjiajie, and Guilin, plus **All China Trips** and **Plan a Custom Trip** entry points.
- Top navigation should be transparent with light text on the home hero, then switch to a light background with dark text after scroll and on inner pages.
- The existing logo asset should be retained while desktop navigation adjusts its sizing and spacing for stronger first-screen brand presence.
- Desktop **China Trips** dropdown should use a refined wide panel with grouped destination links and prominent product/planning entry points, not a small list menu.
- **Home Brand Message** must be a separate section below the hero, refined, concise, and explicit about Syncing Travel helping overseas travelers experience China.
- **Real Moments** uses travel photography and foreign traveler story content together.
- **Traveler Notes** may use public third-party travel comments as source material, but public cards should not show source labels and must not imply Syncing served those travelers.
- **Traveler Notes** should only cover destinations already represented in **China Trips** routes.
- **Why Choose Us** should focus on Local China Team, Private & Flexible Planning, Real Route Resources, and On-Trip Support.
- A **Quick Contact**, a **Custom Trip Request**, and a **Route-based private inquiry** are all **Inquiry / Lead** records.
- An **Inquiry / Lead** leads to **Lead Follow-Up**.
- The **Response Promise** applies to each **Inquiry / Lead**.

> **Note:** Historical ADRs under `docs/adr/` may still use legacy terms such as "small group" or "Group Tour Inquiry". Treat this file as the current terminology authority.

## Example dialogue

> **Dev:** "Should the main navigation link say Tours if it also opens destinations and custom planning?"
> **Domain expert:** "No, use **China Trips** because it covers destinations, routes, and tailor-made planning."
