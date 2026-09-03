# ArduinoHub

ArduinoHub არის Vanilla JavaScript + Supabase პლატფორმა Arduino პროექტების უსაფრთხოდ გამოსაქვეყნებლად. სისტემა იწყება **ნულოვანი პროექტით** — არც demo მონაცემი და არც პაროლი source-ში არ არის.

## ლოკალური გაშვება

1. შექმენით ახალი Supabase პროექტი.
2. Supabase Dashboard → **SQL Editor**-ში სრულად გაუშვით `supabase-schema.sql`.
3. Dashboard → **Authentication → Users**-ში შექმენით სამი ადმინისტრატორის ანგარიში. შექმენით ელფოსტით და ძლიერი პაროლით; პაროლები არც ამ ფაილში და არც კოდში არ ჩაწეროთ.
4. SQL ფაილის ბოლოში მოცემული `insert` ბრძანება გაუშვით თითოეული ანგარიშისთვის, `YOUR_*_EMAIL` რეალური admin ელფოსტით შეცვლის შემდეგ. username-ებად შეიყვანეთ `Zaza`, `Tekla`, `Maia`.
5. Dashboard → **Connect**-დან დააკოპირეთ Project URL და anon/publishable key და ჩასვით `supabase-config.js`-ში. `service_role` გასაღები browser-ში არასოდეს გამოიყენოთ.
6. გაუშვით სტატიკური server, მაგალითად VS Code Live Server-ით ან `npx serve .`, და გახსენით browser-ში. `file://` რეჟიმი არ გამოიყენოთ, რადგან ES modules და Auth redirect სწორად არ იმუშავებს.

## Admin გამოყენება

`admin.html` → ელფოსტა/პაროლი → Dashboard → „ახალი პროექტი“ → შეავსეთ მონაცემები → სურვილისამებრ ატვირთეთ სურათი/ვიდეო → შეინახეთ → გამოაქვეყნეთ.

Dashboard-იდან შესაძლებელია ნახვა, რედაქტირება, გამოქვეყნება/დამალვა, წაშლა და გასვლა. წაშლამდე საჭიროა დადასტურება. ახალი ფაილის ატვირთვისას ძველი მედია cleanup-დება; წაშლისას დაკავშირებული Storage ფაილიც იშლება.

## Viewer გამოყენება

`index.html` → „დამთვალიერებელი“ → ძიება ან კატეგორიის ფილტრი → „ნახვა“. დეტალურ გვერდზე Arduino Code შეიძლება clipboard-ში დაკოპირდეს. მხოლოდ `published = true` პროექტები ჩანს არაშესულ მომხმარებელს.

## უსაფრთხოება და deployment

- PostgreSQL RLS ამოწმებს `public.is_admin()`-ს ყველა create/update/delete ოპერაციაზე; მხოლოდ frontend-ით წვდომა საკმარისი არ არის.
- `admin_users` უკავშირდება Supabase Auth `user_id`-ს. plain-text პაროლები არ ინახება.
- Storage buckets საჯაროა მხოლოდ წასაკითხად, რათა გამოქვეყნებული მედია გამოჩნდეს; ატვირთვა/წაშლა RLS-ით მხოლოდ admin-ებისთვისაა.
- Vercel ან Netlify-ზე ატვირთეთ ეს ფაილები როგორც static site. Dashboard → Authentication → URL Configuration-ში დაამატეთ production URL და local development URL როგორც Redirect URLs.
- static frontend-ის anon key საჯაროა, მაგრამ რეალური დაცვა RLS policies-ია. service role key არასოდეს განათავსოთ deploy-ზე ან Git-ში.

## შემოწმების სია

პირველ ჩატვირთვაზე Projects გვერდმა უნდა აჩვენოს „ჯერ პროექტები არ დამატებულა“. Admin-ით შექმენით პროექტი, შეინახეთ დამალულად/გამოქვეყნებულად, გააკეთეთ refresh და შემდეგ გადაამოწმეთ: გამოქვეყნებული პროექტი ნახულობს Viewer-ს, დამალული — არა.
