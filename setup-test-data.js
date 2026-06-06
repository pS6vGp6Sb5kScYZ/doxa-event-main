const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const url = 'https://zflxgasppkiyvplqbtim.supabase.co';
// Using service role key for admin access (bypasses RLS)
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmbHhnYXNwcGtpeXZwbHFidGltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxODEzNzI0MCwiZXhwIjoxNzMzNjg5MjQwfQ.exJJI6lXDhEWGPMGP5QqVYxQ1D-RCJ4Z9mlZv8Yrqf8';

const supabase = createClient(url, serviceKey);

(async () => {
  try {
    console.log('Checking for existing events...\n');
    const { data: events, error: eventsError } = await supabase
      .from('event_settings')
      .select('id, groom_name, bride_name')
      .limit(1);
    
    if (eventsError) {
      console.log('❌ Error fetching events:', eventsError.message);
      return;
    }
    
    let eventId;
    if (events && events.length > 0) {
      console.log('✓ Found existing event:', events[0].groom_name + ' & ' + events[0].bride_name);
      eventId = events[0].id;
    } else {
      console.log('Creating a new event...');
      
      // Create an event first
      const { data: newEvent, error: createError } = await supabase
        .from('event_settings')
        .insert({
          organizer_id: '00000000-0000-0000-0000-000000000001',
          groom_name: 'Justice',
          bride_name: 'Grace',
          event_date: '2026-12-25T18:00:00Z',
          city: 'Kinshasa',
          subtitle: 'Sont heureux de vous inviter à leur union',
          invite_text: 'Sont heureux de vous inviter à partager ce moment magique',
          ceremony_time: '18h00',
          ceremony_location: 'Église de Kinshasa',
          ceremony_address: 'Avenue de la République, Kinshasa',
          reception_time: '19h00',
          reception_location: 'Salle de réception',
          reception_address: 'Rue de la Paix, Kinshasa',
          drinks_with_alcohol: JSON.stringify(['Vin rouge', 'Bière', 'Champagne']),
          drinks_without_alcohol: JSON.stringify(['Jus', 'Eau', 'Soda']),
          dress_code: 'Élégant',
          gallery_photos: JSON.stringify([]),
          background_music_url: '',
          couple_photo_url: ''
        })
        .select();
      
      if (createError) {
        console.log('❌ Error creating event:', createError.message);
        console.log(JSON.stringify(createError, null, 2));
        return;
      }
      
      eventId = newEvent[0].id;
      console.log('✓ Event created with ID:', eventId);
    }
    
    console.log('\nCreating test guest...');
    const token = crypto.randomUUID();
    
    const { data: guestData, error: guestError } = await supabase
      .from('guests')
      .insert({
        event_id: eventId,
        name: 'Couple David Songa',
        email: 'test@invitation.com',
        phone: '+243123456789',
        qr_token: token,
        table_name: 'Table 1',
        seats: 2,
        status: 'pending'
      })
      .select();
    
    if (guestError) {
      console.log('❌ Error creating guest:', guestError.message);
      console.log(JSON.stringify(guestError, null, 2));
      return;
    }
    
    console.log('✓ Guest created successfully!\n');
    console.log('═'.repeat(60));
    console.log('📌 TEST INVITATION URL:');
    console.log('═'.repeat(60));
    console.log(`http://localhost:5173/invite/${token}`);
    console.log('═'.repeat(60));
    
  } catch (e) {
    console.log('❌ Exception:', e.message);
    console.log(e.stack);
  }
})();
