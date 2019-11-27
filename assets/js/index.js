const contractSource = `

payable contract Meeting =
  // ticket definition
  record ticket = 
    { owner    : address,
      quantity : int }

  
  
  // meeting definition
  record meeting =
    { creatorAddress: address,
      name        : string,
      date        : string,
      time        : string,
      capacity    : int,
      address1    : string,
      address2    : string,
      image       : string,
      ticketPrice : int,
      opened      : bool,
      tickets     : map(address, ticket) }
      
  
  
  record state = 
    { meetings       : map(int, meeting),
      meetingsLength : int }


  // primer meetup, hoy, ahora, 12, 1, imagen, direccion 1, direccion 2d
  // 2, segundo meetup, manana, despues, 23, 2, imagen, dir1, dir2

  
  
  /**
   * Init method
   */
  entrypoint init() = { meetings = {}, meetingsLength = 0 }

  
  
  /**
   * get meeting by id
   */
  entrypoint getMeeting(meetingId: int) : meeting = 
    state.meetings[meetingId]



  /**
   * get meetings length
   */
  entrypoint getMeetingsLength() = state.meetingsLength
  
  
  /**
   * create meeting    
   */
  stateful entrypoint createMeeting(name': string, date': string, time': string,
                                    capacity': int, ticketPrice': int, image': string,
                                    address1': string, address2': string) =
    // 1, primer meetup, hoy, ahora, 12, 1, imagen, direccion 1, direccion 2d
    // 2, segundo meetup, manana, despues, 23, 2, imagen, dir1, dir2
    // meeting values
    let meeting = 
      { creatorAddress = Call.caller,
        name = name',
        date = date', 
        time = time', 
        capacity = capacity', 
        ticketPrice = ticketPrice',
        image = image',
        address1 = address1', 
        address2 = address2', 
        opened = false,
        tickets = {} }
        
    let meetingId = getMeetingsLength()
    let newLength = meetingId + 1
    
    // save meeting in blockchain
    put(state{ meetings[meetingId] = meeting, meetingsLength = newLength })
    
  
  
  /**
   * buy many tickets
   */
  payable stateful entrypoint buyTicket(meetingId: int, quantity': int) =
    let meeting = getMeeting(meetingId)
    
    // validate meeting is opened
    if (!meeting.opened) abort("El evento ha finalizado o está cerrado")
    
    let total = meeting.ticketPrice * quantity'
    
    // validate has money to buy
    if (Call.value < total) abort("No ha enviado el monto suficiente para el total de entradas")
    
    // validate meeting has tickets availables
    if (meeting.capacity < quantity') abort("No puede comprar mas de la cantidad disponible")
    
    let updatedCapacity = meeting.capacity - quantity'
    
    let updatedStatus = updatedCapacity != 0
    
    let tickets = meeting.tickets
    let ownTicketQty = switch(Map.lookup(Call.caller, tickets))
      None => 0
      Some(tkt) => tkt.quantity
    
    let updatedQty = meeting.capacity - quantity'
    let updatedStatus = updatedQty != 0
    
    let ticket =
      { owner = Call.caller,
        quantity = ownTicketQty + quantity' }
        
    Chain.spend(meeting.creatorAddress, Call.value)
        
    let updatedTickets = tickets{ [Call.caller] = ticket }
    
    let updatedMeeting = meeting{ tickets = updatedTickets, capacity = updatedCapacity, opened = updatedStatus }
    
    let updatedMeetings = state.meetings{ [meetingId] = updatedMeeting }
    
    // update state
    put(state{ meetings = updatedMeetings })

   
  
  /**
   * update image
   */
  stateful entrypoint updateImage(meetingId: int, image': string) =
    let meeting = getMeeting(meetingId)
    let updatedMeetings = state.meetings{ [meetingId].image = image' }
    put(state{ meetings = updatedMeetings })
   
   
  /**
   * open meeting
   */
  stateful entrypoint openMeeting(meetingId: int) =
    let meeting = getMeeting(meetingId)
    let updatedMeetings = state.meetings{ [meetingId].opened = true }
    put(state{ meetings = updatedMeetings })
    
  
  
  
  /**
   * close meeting
   */
  stateful entrypoint closeMeeting(meetingId: int) =
    let meeting = getMeeting(meetingId)
    let updatedMeetings = state.meetings{ [meetingId].opened = false }
    put(state{ meetings = updatedMeetings })`;
    
const contractAddress = 'ct_22kwNCS9VmzRCcmjCU5189w42uKNerd5Fh9JGLFxsP8svCDUbF';
var client = null;
var meetings = [];
var meetingsLength = 0;

console.log('nano');

function renderMeetings() {
    if (Mustache) {
        // meetings = meetings.sort(function(a,b){return b.date-a.date})
        var template = $('#template').html();
        if (template) {
            Mustache.parse(template);
            var rendered = Mustache.render(template, {meetings});
            $('#meetingBody').html(rendered);
        }
    }
}

async function callStatic(func, args) {
    const contract = await client.getContractInstance(contractSource, {contractAddress});
    const calledGet = await contract.call(func, args, {callStatic: true}).catch(e => console.error(e));
    const decodedGet = await calledGet.decode().catch(e => console.error(e));
    return decodedGet;
}

async function contractCall(func, args, value) {
    const contract = await client.getContractInstance(contractSource, {contractAddress});
    const calledGet = await contract.call(func, args, {amount: value}).catch(e => console.error(e));
    return calledGet;
}

async function updateMeeting(meetingPosition, meetingId) {
  const meeting = await callStatic('getMeeting', [meetingId]);
  meetings[meetingPosition] = parseMeeting(meeting, meetingPosition);
}

function parseMeeting(meeting, index) {
  return {
    id          : index,
    name        : meeting.name,
    date        : meeting.date,
    time        : meeting.time,
    capacity    : meeting.capacity,
    ticketPrice : meeting.ticketPrice,
    address1    : meeting.address1,
    address2    : meeting.address2,
    image       : meeting.image,
    opened      : meeting.opened,
    statusAction: meeting.opened ? 'Close' : 'Open'
  };
}

function showLoader() {
    $('#loader').addClass('d-flex');
    $('#loader').removeClass('d-none');
    $('#main-content').addClass('d-none');
    $('#main-content').removeClass('d-flex');
}

function hideLoader() {
    $('#loader').removeClass('d-flex');
    $('#loader').addClass('d-none');
    $('#main-content').addClass('d-flex');
    $('#main-content').removeClass('d-none');
}

window.addEventListener('load', async () => {
    showLoader();

    client = await Ae.Aepp();

    meetingsLength = await callStatic('getMeetingsLength', []);

    for (let i = 0; i < meetingsLength; i++) {
        const meeting = await callStatic('getMeeting', [i]);

        meetings.push(parseMeeting(meeting, i));
    }

    renderMeetings();

    hideLoader();
});

/**
 * update meeting image
 */
jQuery("#meetingBody").on("click", ".btnUpdate", async function(event){
    showLoader();
    const image = $('#image').val();
    const dataIndex = event.target.id;
    const foundIndex = meetings.findIndex(meeting => meeting.id == dataIndex);
    
    await contractCall('updateImage', [dataIndex, image], 0);
    
    await updateMeeting(foundIndex, dataIndex);

    renderMeetings();
    hideLoader();
});

/**
 * buy tickets
 */
jQuery("#meetingBody").on("click", ".buyBtn", async function(event){
    showLoader();
    const quantity = $(this).siblings('input').val();
    const dataIndex = event.target.id;
    const foundIndex = meetings.findIndex(meeting => meeting.id == dataIndex);
    const amount = meetings[foundIndex].ticketPrice * quantity;

    if (quantity <= meetings[foundIndex].capacity) {
      await contractCall('buyTicket', [dataIndex, quantity], amount);
      await updateMeeting(foundIndex, dataIndex);
    }

    renderMeetings();
    hideLoader();
});

/**
 * toggle status
 */
jQuery("#meetingBody").on("click", ".toggleStatus", async function(event){
    showLoader();
    const dataIndex = event.target.id;
    const foundIndex = meetings.findIndex(meeting => meeting.id == dataIndex);
    const opened = meetings[foundIndex].opened;
    const capacity = meetings[foundIndex].capacity;
    
    if (capacity > 0) {
        if (!opened)
            await contractCall('openMeeting', [dataIndex], 0);
        else
            await contractCall('closeMeeting', [dataIndex], 0);

        await updateMeeting(foundIndex, dataIndex);
        renderMeetings();
    }

    hideLoader();
});

/**
 * create meeting
 */
$('#createBtn').click(async function(){
    showLoader();
    var name = ($('#name').val()),
        date = ($('#date').val()),
        time = ($('#time').val()),
        capacity = ($('#capacity').val()),
        ticketPrice = ($('#ticketPrice').val()),
        address1 = ($('#address1').val()),
        address2 = ($('#address2').val()),
        image = ($('#image').val());
  
    const args = [ name, date, time, capacity, ticketPrice, image, address1, address2 ];
    await contractCall('createMeeting', args, 0);

    hideLoader();
});