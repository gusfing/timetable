import { createClient } from '@supabase/supabase-js';

const url = "https://olgjnupvbqyafvqjosbg.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZ2pudXB2YnF5YWZ2cWpvc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTM5NzYsImV4cCI6MjA4Nzg4OTk3Nn0.rBLPCRvG0klBTIQT8zqyAjU-jUsMz_seAAGDOhx5tUs";

const supabase = createClient(url, anonKey);

async function test() {
    console.log("Fetching teachers with anon key...");
    const { data: teachers, error: tErr } = await supabase.from('teachers').select('*');
    if (tErr) console.error("Teachers Error:", tErr);
    else console.log("Teachers Count:", teachers?.length);

    console.log("Fetching timetable with anon key...");
    const { data: timetable, error: ttErr } = await supabase.from('timetable').select('*');
    if (ttErr) console.error("Timetable Error:", ttErr);
    else console.log("Timetable Count:", timetable?.length);
}
test();
