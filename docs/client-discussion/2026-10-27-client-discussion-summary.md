# Client Discussion Summary – Workshop Management Software (27/10/2026)

## 1. Parts on the Job Card

Provide an option to create parts directly from the Job Card, assign a vendor, and mark them as added stock.

Allow users to upload the bill while creating parts. In this case, the stock quantity should be incremented automatically.

If a technician adds a part that already exists in the inventory or creates a new part that is not yet available, its price must be reset to 0, without affecting previous Job Cards or any other existing records.

## 2. Quotation and Live Link

The live link should be integrated into the quotation process without making it a mandatory step that blocks the workflow.

There are two types of end customers: existing customers who already trust the garage and new customers who may want to review the quotation, price breakdown, and cost distribution through a live link.

Therefore, sharing the live link and obtaining approval through it should be optional, allowing the garage to proceed based on the customer's requirements and level of trust.

## 3. Mechanic Access and Responsibilities

Mechanics should only need access to vehicle details and their related work.

They should neither view prices nor enter pricing information anywhere in the system.

Any parts added by mechanics should be handled by the owner, who will manage the corresponding entries and pricing details.

## 4. GST Billing and Automatic Data Filling

For GST billing and related processes, provide an API integration or a similar solution to simplify data entry.

When the user enters a GST number, the other available GST-related details, such as the business name and address, should be filled in automatically.

## 5. mParivahan Integration and Vehicle Reminders

Integrate mParivahan or a suitable vehicle-data API to support vehicle-related reminders.

The system should help inform customers when their insurance, PUC, or other relevant vehicle-related requirements are due.

Garages should also be able to provide additional service reminders based on the services they want to offer their customers.

## 6. Vehicle Warranty Card Storage

Add an option to upload and store warranty card images against the vehicle record.

For example, when adding battery details, the user must upload the battery warranty card photo before entering the remaining battery details.

This addresses a common customer issue where customers later ask the garage to provide their warranty card. Storing the image in the vehicle record will make it easily accessible whenever required.

## 7. Indian Garage Terms for Inventory

Add commonly used Indian garage and spare-parts terminology to the inventory module.

Use simple, familiar terms such as clutch wire and other commonly used local names instead of complicated terminology commonly used in Western markets.

Provide autocomplete suggestions for part names so users can select the appropriate term without having to type the entire name manually.

This functionality is specifically required for the parts/inventory module.

## 8. Customer Service History Access (Lower Priority)

Provide an option for customers to log in and view their vehicle service history.

Alternatively, provide PDF support that allows customers to access or receive their bills and complete service history, including all relevant details.

## 9. Scheme and Banner Generation

Rahul Sir currently uses a banner-generation tool within the software he is using.

Provide a similar feature to create promotional banners or schemes and send them to customers.

## 10. Customer Notifications and Reminders

Notifications are a must-have feature.

The system should send customers relevant notifications and reminders, including:

- Bill and billing-related notifications.
- Upcoming service reminders sent when the recommended service interval is approaching, based on the time elapsed since the last service (e.g., around 3 or 6 months).
- Promotional notifications, such as free monsoon vehicle checkups.
- Other service-related reminders and offers that the garage wants to communicate to customers.
