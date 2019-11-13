const contractSource = `
payable contract Meeting =
  // ticket definition
  record ticket = 
    { owner    : address,
      quantity : int }

  
  
  // meeting definition
  record meeting =
    { name        : string,
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


  // 1, primer meetup, hoy, ahora, 12, 1, imagen, direccion 1, direccion 2d
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
  stateful entrypoint createMeeting(meetingId: int, name': string, date': string,
                                    time': string, capacity': int, ticketPrice': int,
                                    image': string, address1': string, address2': string) =
    // 1, primer meetup, hoy, ahora, 12, 1, imagen, direccion 1, direccion 2d
    // 2, segundo meetup, manana, despues, 23, 2, imagen, dir1, dir2
    // meeting values
    let meeting = 
      { name = name',
        date = date', 
        time = time', 
        capacity = capacity', 
        ticketPrice = ticketPrice',
        image = image',
        address1 = address1', 
        address2 = address2', 
        opened = false,
        tickets = {} }
    // save meeting in blockchain
    put(state{ meetings[meetingId] = meeting })
    
  
  
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
        
    let updatedTickets = tickets{ [Call.caller] = ticket }
    
    let updatedMeeting = meeting{ tickets = updatedTickets, capacity = updatedCapacity, opened = updatedStatus }
    
    let updatedMeetings = state.meetings{ [meetingId] = updatedMeeting }
    
    // update state
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

const contractAddress = 'ct_nK62JyqR4ariZHrKpJ2VK85fWHHWUYQU5DiMT3kRdzf21Azou';
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

function showLoader() {
    $('#loader').addClass('d-flex');
    $('#loader').removeClass('d-none');
}

function hideLoader() {
    $('#loader').removeClass('d-flex');
    $('#loader').addClass('d-none');
}

window.addEventListener('load', async () => {
    showLoader();

    client = await Ae.Aepp();

    meetingsLength = await callStatic('getMeetingsLength', []);

    for (let i = 1; i <= meetingsLength; i++) {
        const meeting = await callStatic('getMeeting', [i]);

        meetings.push({
            id          : i,
            name        : meeting.name,
            date        : meeting.date,
            time        : meeting.time,
            capacity    : meeting.capacity,
            ticketPrice : meeting.ticketPrice,
            address1    : meeting.address1,
            address2    : meeting.address2,
            image       : meeting.image,
            opened      : meeting.opened
        });
    }

    renderMeetings();

    hideLoader();
});

jQuery("#meetingBody").on("click", ".buyBtn", async function(event){
    showLoader();
    const quantity = $(this).siblings('input').val();
    const dataIndex = event.target.id;
    const foundIndex = meetings.findIndex(meeting => meeting.id == dataIndex);
    const amount = meetings[foundIndex].ticketPrice * quantity;

    await contractCall('buyTicket', [dataIndex], amount);

    renderMeetings();
    hideLoader();
});


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

        renderMeetings();
    }

    hideLoader();
});

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
  
    const args = [ name, date, time, capacity, ticketPrice, address1, address2, image ];
    await contractSource('createMeeting', args, 0);

    meetings.push({
        id          : meetings.length+1,
        name        : name,
        date        : date,
        time        : time,
        capacity    : capacity,
        ticketPrice : ticketPrice,
        address1    : address1,
        address2    : address2,
        image       : image,
        opened      : false
    });

    renderMemes();
    hideLoader();
});