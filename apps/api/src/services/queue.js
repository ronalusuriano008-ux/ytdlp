class Queue{
  constructor(){
    this.jobs=[];
    this.running=false;
  }

  async add(job){
    this.jobs.push(job);
    this.next();
  }

  async next(){
    if(this.running) return;
    if(!this.jobs.length) return;

    this.running=true;
    const job=this.jobs.shift();
    await job();
    this.running=false;
    this.next();
  }
}

module.exports=new Queue();
