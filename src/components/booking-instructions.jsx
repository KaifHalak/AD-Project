const BOOKING_INSTRUCTIONS = [
  "Application shall be made at least 3 working days before usage.",
  "All information provided in this form must be TRUE upon submission.",
  "If the equipment requested from applicants are to be brought outside the laboratory / workshop, an application letter endorsed by Supervisor / Project Leader / Lecturer needs to be submitted to the Director of Administration of Deputy Vice-Chancellor (Research & Innovation), UTMKL.",
  "The office has the right to reject any activity from the applicant if the activities are suspected to have high risks to the staff / environment and/or can cause damage to the instrument.",
  "For further inquiries on the availability of laboratory and equipment, kindly contact the staff of the respective laboratory.",
];

export function BookingInstructions() {
  return (
    <section className="rounded-2xl border border-primary/20 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-text-main">
        Booking Instructions
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-text-muted">
        {BOOKING_INSTRUCTIONS.map((instruction) => (
          <li key={instruction}>{instruction}</li>
        ))}
      </ol>
    </section>
  );
}
