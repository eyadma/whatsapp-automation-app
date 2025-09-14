    -- Insert comprehensive message templates in 3 languages
    -- This script adds various template styles: with time, no time, with emojis, etc.

    -- ========================================
    -- DELIVERY NOTIFICATION TEMPLATES
    -- ========================================

    -- Template 1: Simple delivery notification (no time)
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Simple Delivery Notification',
    'مرحباً {name}! طردك {package_id} جاهز للتسليم.',
    'שלום {name}! החבילה שלך {package_id} מוכנה למסירה.',
    'Hello {name}! Your package {package_id} is ready for delivery.',
    true, true, NOW()
    );

    -- Template 2: Delivery with time
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Delivery with Time',
    'مرحباً {name}! طردك {package_id} سيتم تسليمه في {eta}.',
    'שלום {name}! החבילה שלך {package_id} תימסר ב-{eta}.',
    'Hello {name}! Your package {package_id} will be delivered at {eta}.',
    true, true, NOW()
    );

    -- Template 3: Delivery with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Delivery with Emojis',
    '📦 مرحباً {name}! طردك {package_id} جاهز للتسليم! 🚚',
    '📦 שלום {name}! החבילה שלך {package_id} מוכנה למסירה! 🚚',
    '📦 Hello {name}! Your package {package_id} is ready for delivery! 🚚',
    true, true, NOW()
    );

    -- Template 4: Delivery with time and emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Delivery with Time and Emojis',
    '📦 مرحباً {name}! طردك {package_id} سيتم تسليمه في {eta} ⏰',
    '📦 שלום {name}! החבילה שלך {package_id} תימסר ב-{eta} ⏰',
    '📦 Hello {name}! Your package {package_id} will be delivered at {eta} ⏰',
    true, true, NOW()
    );

    -- ========================================
    -- DELAY NOTIFICATION TEMPLATES
    -- ========================================

    -- Template 5: Simple delay notification
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Simple Delay Notification',
    'مرحباً {name}! نعتذر عن التأخير في تسليم طردك {package_id}.',
    'שלום {name}! אנחנו מתנצלים על העיכוב במסירת החבילה שלך {package_id}.',
    'Hello {name}! We apologize for the delay in delivering your package {package_id}.',
    true, true, NOW()
    );

    -- Template 6: Delay with new time
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Delay with New Time',
    'مرحباً {name}! نعتذر عن التأخير. طردك {package_id} سيتم تسليمه في {eta}.',
    'שלום {name}! אנחנו מתנצלים על העיכוב. החבילה שלך {package_id} תימסר ב-{eta}.',
    'Hello {name}! We apologize for the delay. Your package {package_id} will be delivered at {eta}.',
    true, true, NOW()
    );

    -- Template 7: Delay with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Delay with Emojis',
    '😔 مرحباً {name}! نعتذر عن التأخير في طردك {package_id} 📦',
    '😔 שלום {name}! אנחנו מתנצלים על העיכוב בחבילה שלך {package_id} 📦',
    '😔 Hello {name}! We apologize for the delay with your package {package_id} 📦',
    true, true, NOW()
    );

    -- ========================================
    -- PICKUP NOTIFICATION TEMPLATES
    -- ========================================

    -- Template 8: Simple pickup notification
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Simple Pickup Notification',
    'مرحباً {name}! طردك {package_id} جاهز للاستلام من مكتبنا.',
    'שלום {name}! החבילה שלך {package_id} מוכנה לאיסוף מהמשרד שלנו.',
    'Hello {name}! Your package {package_id} is ready for pickup from our office.',
    true, true, NOW()
    );

    -- Template 9: Pickup with time
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Pickup with Time',
    'مرحباً {name}! طردك {package_id} جاهز للاستلام من مكتبنا في {eta}.',
    'שלום {name}! החبילה שלך {package_id} מוכנה לאיסוף מהמשרד שלנו ב-{eta}.',
    'Hello {name}! Your package {package_id} is ready for pickup from our office at {eta}.',
    true, true, NOW()
    );

    -- Template 10: Pickup with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Pickup with Emojis',
    '🏢 مرحباً {name}! طردك {package_id} جاهز للاستلام 📦',
    '🏢 שלום {name}! החבילה שלך {package_id} מוכנה לאיסוף 📦',
    '🏢 Hello {name}! Your package {package_id} is ready for pickup 📦',
    true, true, NOW()
    );

    -- ========================================
    -- RETURN ITEMS TEMPLATES
    -- ========================================

    -- Template 11: Simple return items notification
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Simple Return Items',
    'مرحباً {name}! طردك {package_id} يحتوي على عناصر قابلة للإرجاع.',
    'שלום {name}! החבילה שלך {package_id} מכילה פריטים להחזרה.',
    'Hello {name}! Your package {package_id} contains returnable items.',
    true, true, NOW()
    );

    -- Template 12: Return items with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Return Items with Emojis',
    '🔄 مرحباً {name}! طردك {package_id} يحتوي على عناصر قابلة للإرجاع 📦',
    '🔄 שלום {name}! החבילה שלך {package_id} מכילה פריטים להחזרה 📦',
    '🔄 Hello {name}! Your package {package_id} contains returnable items 📦',
    true, true, NOW()
    );

    -- Template 13: Return items with instructions
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Return Items with Instructions',
    'مرحباً {name}! طردك {package_id} يحتوي على عناصر قابلة للإرجاع. يرجى الاحتفاظ بها.',
    'שלום {name}! החבילה שלך {package_id} מכילה פריטים להחזרה. אנא שמור עליהם.',
    'Hello {name}! Your package {package_id} contains returnable items. Please keep them safe.',
    true, true, NOW()
    );

    -- ========================================
    -- CUSTOMER SERVICE TEMPLATES
    -- ========================================

    -- Template 14: Customer service greeting
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Customer Service Greeting',
    'مرحباً {name}! كيف يمكننا مساعدتك اليوم؟',
    'שלום {name}! איך אנחנו יכולים לעזור לך היום?',
    'Hello {name}! How can we help you today?',
    true, true, NOW()
    );

    -- Template 15: Customer service with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Customer Service with Emojis',
    '👋 مرحباً {name}! كيف يمكننا مساعدتك اليوم؟ 😊',
    '👋 שלום {name}! איך אנחנו יכולים לעזור לך היום? 😊',
    '👋 Hello {name}! How can we help you today? 😊',
    true, true, NOW()
    );

    -- Template 16: Thank you message
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Thank You Message',
    'شكراً لك {name}! نقدّر ثقتك في خدماتنا.',
    'תודה לך {name}! אנחנו מעריכים את האמון שלך בשירותים שלנו.',
    'Thank you {name}! We appreciate your trust in our services.',
    true, true, NOW()
    );

    -- Template 17: Thank you with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Thank You with Emojis',
    '🙏 شكراً لك {name}! نقدّر ثقتك في خدماتنا ❤️',
    '🙏 תודה לך {name}! אנחנו מעריכים את האמון שלך בשירותים שלנו ❤️',
    '🙏 Thank you {name}! We appreciate your trust in our services ❤️',
    true, true, NOW()
    );

    -- ========================================
    -- URGENT DELIVERY TEMPLATES
    -- ========================================

    -- Template 18: Urgent delivery
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Urgent Delivery',
    'عاجل! مرحباً {name}! طردك {package_id} يحتاج تسليم فوري.',
    'דחוף! שלום {name}! החבילה שלך {package_id} דורשת מסירה מיידית.',
    'Urgent! Hello {name}! Your package {package_id} requires immediate delivery.',
    true, true, NOW()
    );

    -- Template 19: Urgent delivery with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Urgent Delivery with Emojis',
    '🚨 عاجل! مرحباً {name}! طردك {package_id} يحتاج تسليم فوري! ⚡',
    '🚨 דחוף! שלום {name}! החבילה שלך {package_id} דורשת מסירה מיידית! ⚡',
    '🚨 Urgent! Hello {name}! Your package {package_id} requires immediate delivery! ⚡',
    true, true, NOW()
    );

    -- ========================================
    -- FOLLOW-UP TEMPLATES
    -- ========================================

    -- Template 20: Follow-up after delivery
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Follow-up After Delivery',
    'مرحباً {name}! هل وصل طردك {package_id} بحالة جيدة؟',
    'שלום {name}! האם החבילה שלך {package_id} הגיעה במצב טוב?',
    'Hello {name}! Did your package {package_id} arrive in good condition?',
    true, true, NOW()
    );

    -- Template 21: Follow-up with emojis
    INSERT INTO public.message_templates (
    name, template_arabic, template_hebrew, template_english, 
    is_global, is_active, created_at
    ) VALUES (
    'Follow-up with Emojis',
    '✅ مرحباً {name}! هل وصل طردك {package_id} بحالة جيدة؟ 😊',
    '✅ שלום {name}! האם החבילה שלך {package_id} הגיעה במצב טוב? 😊',
    '✅ Hello {name}! Did your package {package_id} arrive in good condition? 😊',
    true, true, NOW()
    );

    -- ========================================
    -- VERIFICATION
    -- ========================================

    -- Check how many templates were inserted
    SELECT 
    'Templates inserted successfully!' as status,
    COUNT(*) as total_templates,
    COUNT(CASE WHEN is_global = true THEN 1 END) as global_templates,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_templates
    FROM public.message_templates;

    -- Show all inserted templates
    SELECT 
    id,
    name,
    is_global,
    is_active,
    created_at
    FROM public.message_templates
    ORDER BY id;
