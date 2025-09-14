 ERROR  Failed to send to منال: [TypeError: _personalizedMessage3.substring is not a function (it is undefined)]
 LOG  Template 23 for area 548: {"areaPreferences": {"preferred_language_1": "ar", "preferred_language_2": null}, "templateLanguages": {"arabic": true, "english": true, "hebrew": true}} ERROR  Failed to send to منال: [TypeError: _personalizedMessage3.substring is not a function (it is undefined)]
 LOG  Template 23 for area 548: {"areaPreferences": {"preferred_language_1": "ar", "preferred_language_2": null}, "templateLanguages": {"arabic": true, "english": true, "hebrew": true}}-- Test inserting data into locations table
-- Replace 'YOUR_USER_ID' with your actual user ID

-- First, let's see what's in the customers table
SELECT 
  'Customers table data:' as info,
  COUNT(*) as total_customers
FROM public.customers;

-- Show sample customer data
SELECT 
  'Sample customer data:' as info,
  id,
  user_id,
  name,
  phone,
  shipment_id,
  package_id,
  area
FROM public.customers 
LIMIT 3;

-- Test inserting a sample location (replace with your actual user_id)
-- You can get your user_id from the customers table above
INSERT INTO public.locations (
  user_id,
  name,
  phone,
  shipment_id,
  package_id,
  area,
  package_price,
  has_return,
  business_name,
  tracking_number,
  whatsapp_message,
  items_description,
  quantity,
  status
) 
SELECT 
  user_id,
  name,
  phone,
  shipment_id,
  package_id,
  area,
  package_price,
  has_return,
  business_name,
  tracking_number,
  whatsapp_message,
  items_description,
  quantity,
  status
FROM public.customers 
WHERE user_id = (SELECT user_id FROM public.customers LIMIT 1)
LIMIT 1;

-- Check if the insert worked
SELECT 
  'Locations table after insert:' as info,
  COUNT(*) as total_locations
FROM public.locations;

-- Show the inserted location
SELECT 
  'Inserted location:' as info,
  id,
  user_id,
  name,
  phone,
  shipment_id,
  package_id,
  area
FROM public.locations 
ORDER BY created_at DESC 
LIMIT 1;
