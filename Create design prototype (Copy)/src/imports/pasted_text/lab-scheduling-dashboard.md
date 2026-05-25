Create a complete desktop web app UI flow for a laboratory resource booking system called “Scholarly Lab”. The output must look like a polished, high-fidelity admin/research booking dashboard, closely matching a soft minimal academic operations style.

OVERALL PRODUCT
This is a laboratory booking and equipment reservation system for a research facility. It allows users to:
- view lab availability in a timetable
- reserve labs and optional equipment
- view booking records
- modify reservations
- manage equipment
- add new equipment
- handle scheduling conflicts

IMPORTANT OUTPUT REQUIREMENTS
- Generate ALL pages/screens in one consistent design system
- Use desktop web layout only
- Maintain the exact visual style across all screens
- Make the interface feel premium, calm, structured, and institutional
- Use rounded cards, soft shadows, large clean typography, lots of whitespace
- The design should feel very close to the provided references:
  - warm off-white / beige background
  - magenta primary action color
  - very light gray cards and fields
  - muted green / pink / yellow status pills
  - black or very dark gray headings
  - light lavender user avatar circle
- Avoid bright blue, harsh gradients, dark mode, glassmorphism, or playful consumer-app styling
- Keep the UI elegant, minimal, and professional

STYLE DIRECTION
Visual tone:
- modern research facility dashboard
- premium but understated
- minimal and functional
- editorial typography with strong hierarchy
- gentle, soft, rounded UI
- subtle depth, not heavy shadows
- feels like a laboratory operations platform used by university researchers and admins

COLOR PALETTE
Use colors very close to:
- Main background: warm beige / ivory (#F4F0E6 or similar)
- Sidebar background: slightly lighter warm neutral
- Primary CTA color: rich magenta / berry (#B0005A to #B3005F range)
- Primary hover/darker: deeper berry
- Heading text: very dark gray / near black
- Body text: muted gray-brown
- Borders/dividers: very light warm gray
- Card background: soft cream / off-white
- Input background: light neutral gray / white with warm tint
- Success/available: muted mint green
- Booked/error: dusty rose / soft red
- Pending: soft mauve / muted pink
- Maintenance: warm yellow / amber
- User avatar background: pale lavender

TYPOGRAPHY
Use a clean geometric or neo-grotesk sans style similar to:
- Inter
- Plus Jakarta Sans
- Satoshi
- Manrope
Choose one and stay consistent.

Type scale guidance:
- Page title / hero title: bold, very large, around 44–56 px
- Section titles: 24–32 px
- Card titles / labels: 16–22 px
- Body text: 13–16 px
- Tiny metadata / captions: 10–12 px with increased tracking
- Use bold headings and lighter supporting text

LAYOUT SYSTEM
Create a desktop layout around 1366 px wide.
Persistent left sidebar navigation + main content area.
Spacing should be generous and consistent.

Structure:
- Fixed left sidebar: approx 220–250 px wide
- Main content area fills remaining width
- Top bar area inside content for page name, search, and user profile
- Rounded containers and cards throughout
- Use 8 px based spacing system
- Large content padding, around 32–48 px on page edges

GLOBAL COMPONENTS TO REUSE
1. Sidebar
- Logo block at top:
  - icon in magenta rounded square
  - text: “Scholarly Lab”
  - subtext: “CORE FACILITY”
- Nav items:
  - Dashboard
  - Equipment
  - Bookings
  - Booking Records
- Active nav item shown with rounded light highlight and magenta accent
- Small icon left of each item
- At bottom, large magenta rounded button: “+ Quick Book”

2. Top right user block
- circular pale lavender avatar icon
- label: “User Name”

3. Search field
- rounded rectangular search bar
- subtle icon
- very light fill

4. Buttons
- Primary button: magenta background, white text, rounded pill-ish corners, soft shadow
- Secondary button: white/neutral background, subtle border
- Ghost/destructive cancel button: light background or outline with magenta or muted red text

5. Status pills / chips
- AVAILABLE = muted mint green pill
- BOOKED = dusty rose / muted red pill
- PENDING = muted pink / mauve pill
- IN USE = pink pill
- MAINTENANCE = soft yellow pill

6. Cards
- Rounded 20–28 px
- Very soft border or shadow
- Cream / off-white fill
- Lots of internal padding

7. Inputs
- Rounded 10–14 px
- Light background
- Minimal border
- Clean labels in uppercase micro text for form sections

APP INFORMATION ARCHITECTURE
Create the following screens:

SCREEN 1 — LABORATORY SCHEDULING PAGE
Purpose:
Main timetable dashboard showing lab availability by time slot.

Header/content:
- small page label at top: “Laboratory Booking”
- very large hero heading on left:
  “Laboratory
   Resource
   Scheduling”
- small muted description text below heading: “Description or tip”
- on upper right of content area include a legend with 3 colored dots and labels:
  - Available
  - Booked
  - Pending

Main scheduling card:
- large rounded timetable container centered in main area
- top row of card:
  - left arrow
  - date title: “Tuesday, Apr 21”
  - right arrow
  - button: “TODAY”
  - button: “PICK DATE”
- below, a schedule grid
- first column label: “LAB RESOURCE”
- row items:
  - Chemistry Lab
  - Physics Lab
  - Biology Lab
  - Electrical Lab
- each lab row includes small location text beneath lab name
- columns for time slots at least:
  - 08:00
  - 09:00
  - 10:00
  - 11:00
- show slot blocks with different fills:
  - available = pale mint
  - booked = pale dusty rose with center label “BOOKED”
  - pending = pale mauve with center label “PENDING”
- give timetable a clean grid but keep it soft, not spreadsheet harsh
- row cards and slots should have rounded rectangles

Design notes:
- This should be the most visually important screen
- Strong hierarchy and generous breathing room
- Make the schedule feel interactive and premium

SCREEN 2 — BOOKING RECORDS PAGE
Purpose:
Shows the user’s submitted booking requests and their statuses.

Header/content:
- page label: “Laboratory Booking”
- large heading: “Booking Records”
- supporting paragraph:
  “Comprehensive log of institutional lab access and high-precision equipment usage across the Oxford Research complex. Filter by status or department for reporting.”
  Use this text or a very close refined variation.

Main content:
- stack 2 large booking record cards vertically
- each card should contain:
  - small pink badge: “YOUR REQUEST”
  - thumbnail image of a lab / research room on left
  - booking details in center:
    - large title: “Lab Name”
    - subtitle: “Laboratory–Location”
    - row with calendar icon + “Date”
    - row with clock icon + “Time”
  - status text on top right: “Pending Approval”
  - two action buttons on right:
    - “Trace Booking”
    - “Modify Request”
- overall cards have very soft cream background, rounded corners, lots of whitespace

Design notes:
- Keep it clean and card-driven
- Feel like a request tracking dashboard
- Maintain the same left sidebar and top-right user avatar

SCREEN 3 — EQUIPMENT MANAGEMENT PAGE
Purpose:
Equipment listing / inventory overview.

Header/content:
- page label or top text: “Laboratory Booking”
- large title: “Equipment Management”
- top bar includes search field and user profile
- top-right prominent magenta button: “Add New Equipment”

Below title:
- wide rounded search box centered/left with placeholder like:
  “Search by instrument name or ID...”
- search icon at right side of field

Main equipment list card:
- large table-like rounded container
- header row with columns:
  - Instrument Details
  - Location
  - Status
- list items:
  1. Mass Spectrometer
  2. Ultra Centrifuge
  3. Cryostat Microtome
  4. Electron Microscope
  5. Flow Cytometer
  6. CO2 Incubator
- each row includes:
  - soft icon tile on left
  - instrument name
  - small ID under name (e.g. ID: MS-XXXXX)
  - location text
  - status pill (available / in use / maintenance)
- keep rows roomy and elegant

Design notes:
- Feels like a refined admin inventory page, not a dense corporate table
- Use lots of vertical spacing

SCREEN 4 — ADD NEW EQUIPMENT PAGE
Purpose:
Form for admins to add a new equipment entry.

Header/content:
- page label at top: “Laboratory Booking”
- top search bar can remain visible for consistency
- top-right user avatar block
- large title: “Add New Equipment”

Main layout:
Split into 2 main panels inside content area:
LEFT PANEL — form card
RIGHT PANEL — technical documentation upload card

LEFT FORM CARD
- large rounded card
- fields laid out in 2 columns where appropriate:
  - Equipment Name
  - Model / Serial Number
  - Laboratory Location (dropdown)
  - Category (dropdown)
  - Acquisition Date
- labels should be uppercase micro labels
- fields should be rounded and minimal
- bottom actions:
  - text button or subtle button: “Cancel”
  - primary magenta button: “Save Equipment”

RIGHT UPLOAD CARD
- large rounded upload card
- icon at top
- heading: “Technical Documentation”
- subtext:
  “Upload PDF manual or calibration sheets (Max 25MB)”
- rounded secondary button: “Browse Files”

Decorative detail:
- add a soft abstract icon tile or equipment icon near upper right area of page for balance

Design notes:
- Sophisticated, not form-heavy
- Clear admin flow

SCREEN 5 — RESOURCE RESERVATION PAGE
Purpose:
Main booking form for reserving labs and optional equipment.

Header/content:
- page label: “Laboratory Booking”
- title: “Resource Reservation”
- small back arrow below title or near title

Create a 5-step booking layout inside one vertical flow:

SECTION 01 — LABORATORY SELECTION
- section label in uppercase tiny text: “01 LABORATORY SELECTION”
- row of 3 selectable lab cards:
  - Chemistry Lab
  - Physics Lab
  - Biology Lab
- each card contains:
  - small lab icon
  - lab name
  - location
  - price
- selected card has magenta border / accent

SECTION 02 — EQUIPMENT SELECTION
- section label: “02 EQUIPMENT SELECTION”
- on far right of section header include small toggle with label:
  “IS IT NECESSARY TO USE EQUIPMENT? (OPTIONAL)”
- below, show 2 selectable equipment cards:
  - Confocal Microscope XI-400
  - Illumina DNA Sequencer
- each card includes location / room and price
- selected card highlighted with magenta outline
- include long search field below cards: “Search other equipment...”

SECTION 03 — DATE & TIME ALLOCATION
- section label: “03 DATE & TIME ALLOCATION”
- create a 2-column card:
  LEFT:
  - mini calendar widget displaying Apr 2026
  - selected date highlighted in magenta
  RIGHT:
  - dropdown/input for Start Time
  - dropdown/input for End Time
  - availability indicator bar below: “SLOT AVAILABLE” in soft green

SECTION 04 — USAGE CONTEXT
- section label: “04 USAGE CONTEXT”
- large rounded textarea with placeholder like:
  “Briefly describe research objective...”

SECTION 05 — BILLING
- section label: “05 BILLING”
- two payment option cards:
  - Online Payment
  - Account Grant
- selected payment option highlighted with magenta border/radio

BOTTOM AREA
- left bottom:
  - small label: “EST. TOTAL”
  - large price: “$85.00” in magenta
- near bottom center/right small muted text:
  “24h cancellation policy applies”
- bottom-right primary button:
  “Confirm Booking”

Design notes:
- This page must feel like a refined multi-step transactional flow
- Very polished, very clear hierarchy
- Keep all section numbers and section titles visible

SCREEN 6 — MODIFY RESERVATION (LAB) PAGE
Purpose:
Edit an existing booking’s lab, date, time, and reason.

Header/content:
- title: “Modify Your Reservation”
- small back arrow under or beside title

Main section 1:
“Modify Laboratory”
- horizontal row of 4 lab cards with image thumbnails:
  - Biology Lab
  - Chemistry Lab
  - Physics Lab
  - Electrical Lab
- each shows image, lab name, location
- selected card outlined in magenta, include small selected radio/check marker on corner

Main section 2:
Large rounded card with title:
“Select a new date and time window”
- left side:
  - full mini calendar
  - month dropdown
  - year dropdown
  - navigation arrows
- right side:
  - Start Time input
  - End Time input
- bottom inside this card:
  - section label: “REASON FOR MODIFICATION”
  - wide textarea with placeholder:
    “Briefly explain the adjustment for the peer-review audit trail...”

Page bottom actions:
- left outlined/destructive button:
  “Cancel Reservation”
- right primary magenta button:
  “Save Changes”

Design notes:
- The edit flow should feel trustworthy and structured
- Keep the layout airy

SCREEN 7 — MODIFY RESERVATION (EQUIPMENT) PAGE
Purpose:
Edit equipment selection and time.

Header/content:
- title: “Modify Your Reservation”
- back arrow

Top section:
“Modify Equipment”
- search field: “Search other equipment...”
- row of 2 equipment cards:
  - Confocal Microscope
    subtitle: “Zeiss LSM 880”
    status pill: AVAILABLE
  - DNA Sequencer
    subtitle: “Illumina MiSeq”
    status pill: AVAILABLE
- selected equipment card should show magenta radio/outline

Middle section:
Same large rounded date/time window card as previous screen:
- mini calendar on left
- Start Time / End Time on right
- textarea for reason below

Bottom actions:
- “Cancel Reservation”
- “Save Changes”

Design notes:
- Consistent with lab modification page
- Use same component structure

SCREEN 8 — SCHEDULING CONFLICT PAGE
Purpose:
Error state when selected slot is already booked.

Layout:
- keep page minimal
- large centered rounded error card inside content area
- soft blush/pink error card background
- top small badge: “BOOKING ERROR”
- large warning icon / triangle icon on left upper area
- bold heading:
  “Scheduling Conflict”
- explanatory text:
  “The selected time slot for this laboratory is already reserved by another researcher. Please choose a different time or view the full schedule to find an available opening.”
- large primary button at bottom of card:
  “Back to Schedule”
- add subtle right-arrow icon inside button
- background around card remains warm beige and minimal

Design notes:
- Calm, premium error handling
- Not alarming or harsh
- Still consistent with rest of system

CONSISTENCY RULES ACROSS ALL SCREENS
- Reuse same sidebar, user profile block, button language, field styles, status chips
- Keep corner radii soft and consistent
- Use consistent content widths and margins
- All screens should look like part of the same product and same design file
- Use matching icon style throughout: simple line icons, minimal, professional
- Avoid overcrowding
- Prefer large whitespace over dense information
- Preserve a high-end dashboard look

ICONOGRAPHY
Use thin minimal line icons for:
- dashboard
- equipment
- bookings
- booking records
- user
- search
- calendar
- clock
- lab
- file upload
- warning
- payment
- microscope/instrument placeholders

INTERACTION / STATE REQUIREMENTS TO SHOW VISUALLY
Include clear visual states for:
- active sidebar item
- selected card
- available slot
- booked slot
- pending slot
- selected payment method
- selected lab/equipment
- selected date
- disabled/non-selected options
- primary vs secondary actions

COPY / LABELS
Use the exact or very close labels below wherever possible:
- Scholarly Lab
- CORE FACILITY
- Dashboard
- Equipment
- Bookings
- Booking Records
- Quick Book
- Laboratory Booking
- Laboratory Resource Scheduling
- Equipment Management
- Add New Equipment
- Resource Reservation
- Modify Your Reservation
- Booking Records
- Scheduling Conflict
- Confirm Booking
- Save Equipment
- Save Changes
- Cancel Reservation
- Modify Request
- Trace Booking
- Add New Equipment
- Available
- Booked
- Pending
- In Use
- Maintenance
- Pending Approval

FINAL DELIVERY EXPECTATION
Generate a complete multi-screen high-fidelity Figma UI kit / flow for this product.
The final result should feel like a polished case-study-ready product design for a modern university lab booking and equipment management platform.
Prioritize visual fidelity, consistency, spacing, hierarchy, and accurate recreation of the described screens over inventing new features or changing the structure.