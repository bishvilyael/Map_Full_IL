V2 - תיקון חיבור בפועל למפה מלאה

מה עודכן:
1. index.html
   נוספה טעינה של הקובץ המשותף החדש:
   https://bishvilyael.github.io/Map_Shared/js/map-shared-extra-tools.js

2. geojson.js
   - כפתור זום עולמי נוצר בפועל עם initMap.
   - הכפתור מושבת בתחילת טעינה ומופעל רק לאחר סיום טעינת rest.
   - רשימת יעלים מורחבת נבנית רק בזמן פתיחת השכבה, לא בזמן פתיחת חלונית השכבות.
   - הטקסט בשורה משתמש ב-buildLayerItemDisplayText מתוך הקובץ המשותף.

3. Map_Shared/js/map-shared-extra-tools.js
   קובץ חדש בלבד. לא מחליף קבצים קיימים בריפו המשותף.

סדר פריסה:
1. להעלות קודם את Map_Shared/js/map-shared-extra-tools.js לריפו Map_Shared.
2. אחר כך להעלות את index.html ו-geojson.js לריפו המפה.
