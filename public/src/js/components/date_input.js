/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

class DateInput extends EventEmitter
{
    constructor() {
        super();

		this.dom = document.createElement('div');

		// labels
		this.texts = document.createElement('div');
		
		this.slashTxt1 = document.createElement('div');
		this.slashTxt1.innerText = "/";
		this.slashTxt1.className = "date_input date_input_slash_txt_1";
		this.texts.appendChild(this.slashTxt1);
		
		this.slashTxt2 = document.createElement('div');
		this.slashTxt2.innerText = "/";
		this.slashTxt2.className = "date_input date_input_slash_txt_2";
		this.texts.appendChild(this.slashTxt2);
		
		this.colonTxt1 = document.createElement('div');
		this.colonTxt1.innerText = ":";
		this.colonTxt1.className = "date_input date_input_colon_txt_2";
		this.texts.appendChild(this.colonTxt1);
		
		this.colonTxt2 = document.createElement('div');
		this.colonTxt2.innerText = ":";
		this.colonTxt2.className = "date_input date_input_colon_txt_2";
		this.texts.appendChild(this.colonTxt2);
		
		this.dom.appendChild(this.texts);

		// inputs
		this.inputs = document.createElement('div');

		this.yearIn = document.createElement('input');
        this.yearIn.type = "number";
        this.yearIn.value = "2020";
        this.yearIn.min = 0;
        this.yearIn.max = 9999;
        this.yearIn.step = 1;
		this.yearIn.className = "date_input date_input_year_in";
		this.inputs.appendChild(this.yearIn);

		this.monthIn = document.createElement('input');
        this.monthIn.type = "number";
        this.monthIn.min = 1;
        this.monthIn.max = 12;
        this.monthIn.step = 1;
        this.monthIn.value = "1";
		this.monthIn.className = "date_input date_input_month_in";
		this.inputs.appendChild(this.monthIn);

		this.dayIn = document.createElement('input');
        this.dayIn.type = "number";
        this.dayIn.value = "2";
        this.dayIn.min = 1;
        this.dayIn.max = 31;
        this.dayIn.step = 1;
		this.dayIn.className = "date_input date_input_day_in";
		this.inputs.appendChild(this.dayIn);

		this.hourIn = document.createElement('input');
        this.hourIn.type = "number";
        this.hourIn.value = "0";
        this.hourIn.min = 0;
        this.hourIn.max = 23;
        this.hourIn.step = 1;
		this.hourIn.className = "date_input date_input_hour_in";
		this.inputs.appendChild(this.hourIn);

		this.minuteIn = document.createElement('input');
        this.minuteIn.type = "number";
        this.minuteIn.value = "0";
        this.minuteIn.min = 0;
        this.minuteIn.max = 59;
        this.minuteIn.step = 1;
		this.minuteIn.className = "date_input date_input_minute_in";
		this.inputs.appendChild(this.minuteIn);

		this.secondIn = document.createElement('input');
        this.secondIn.type = "number";
        this.secondIn.value = "0";
        this.secondIn.min = 0;
        this.secondIn.max = 23;
        this.secondIn.step = 1;
		this.secondIn.className = "date_input date_input_second_in";
		this.inputs.appendChild(this.secondIn);

		this.dom.appendChild(this.inputs);
	}
	
	setDate(date) {
		const year = date.getFullYear();
		const month = String(date.getMonth()+1);
		const day = String(date.getDate());
		const hour = String(date.getHours());
		const minutes = String(date.getMinutes());
		const second = String(date.getSeconds());

		this.yearIn.value = year;
		this.monthIn.value = month;
		this.dayIn.value = day;
		this.hourIn.value = hour;
		this.minuteIn.value = minutes;
		this.secondIn.value = second;
	}

	getDate() {
		return new Date(
			Number(this.yearIn.value), 
			Number(this.monthIn.value) - 1, 
			Number(this.dayIn.value), 
			Number(this.hourIn.value), 
			Number(this.minuteIn.value),
			Number(this.secondIn.value));
	}

    getDOM() {
        return this.dom;
    }
}

export default DateInput;