var meetings = [
    {
        id          : 1,
        name        : "primer meetup",
        date        : "20/12/2019",
        time        : "06:00 PM",
        capacity    : 25,
        ticketPrice : 1,
        address1    : "Linea uno de la direccion",
        address2    : "linea dos de la direccion",
        image       : "https://pbs.twimg.com/media/Dsdt6gOXcAAksLu.jpg",
        opened      : true
    },
    {
        id          : 2,
        name        : "segundo meetup",
        date        : "21/12/2019",
        time        : "06:00 PM",
        capacity    : 15,
        ticketPrice : 1,
        address1    : "Linea uno de la direccion",
        address2    : "linea dos de la direccion",
        image       : "https://pbs.twimg.com/media/C4Vu1S0WYAA3Clw.jpg",
        opened      : true
    }
];

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

function renderMeetings() {
    // meetings = meetings.sort(function(a,b){return b.date-a.date})
    var template = $('#template').html();
    Mustache.parse(template);
    var rendered = Mustache.render(template, {meetings});
    $('#meetingBody').html(rendered);
}

window.addEventListener('load', async () => {
    $("#loader").show();

    client = await Ae.Aepp();

    const contract = await client.getContractInstance(contractSource, {contractAddress});
    const calledGet = await contract.call('getMeetingsLength', [], {callStatic: true}).catch(e => console.error(e));
    console.log('calledGet', calledGet);

    const decodedGet = await calledGet.decode().catch(e => console.error(e));
    console.log('decodedGet', decodedGet);

    renderMeetings();

    $("#loader").hide();
});

jQuery("#meetingBody").on("click", ".buyBtn", async function(event){
  const value = $(this).siblings('input').val();
  const dataIndex = event.target.id;
  const foundIndex = meetings.findIndex(meeting => meeting.id == dataIndex);
  meetings[foundIndex].capacity -= parseInt(value, 10);
  renderMeetings();
});

// $('#createBtn').click(async function(){
//     var name = ($('#regName').val()),
//         url = ($('#regUrl').val());
  
//     memeArray.push({
//       creatorName: name,
//       memeUrl: url,
//       index: memeArray.length+1,
//       votes: 0
//     })
//     renderMemes();
//   });