//  Подключаем библеотеки
const VkBot     = require('node-vk-bot-api');
const Markup    = require('node-vk-bot-api/lib/markup');
const mongoose  = require('mongoose');
const strftime  = require('strftime');

//  Логинимся, инициализируемся
require('dotenv').config();
mongoose.connect(process.env.MONGOTOKEN, {useNewUrlParser: true, useUnifiedTopology: true}); //  Логиним mongoose
const bot = new VkBot(process.env.TOKEN);

//  Модель информации о юзере
const usersinfo = mongoose.model("usersinfo", mongoose.Schema({
    ID: String,
    variant: String,
    currentQ: String,
    orders: [ {variant: String, num: Number, payment: String, status: String, date: String, attachment: [String] } ],
    tempOrder: mongoose.Schema.Types.Mixed
}, { collection: 'usersinfo' }))

//  Разные менюшки
let markups = {
    menu: Markup.keyboard([
        Markup.button('Создать заказ', 'positive'),
        'Список заказов',
        'Посмотреть выполненные',
    ], { columns: 2 }).oneTime(),

    yesno: Markup.keyboard([
        Markup.button('Да', 'positive'),
        Markup.button('Нет', 'negative'),
    ], { columns: 2 }).oneTime(),

    cancelOrder: Markup.keyboard([
        Markup.button('Отмена', 'negative')
    ], { columns: 1 }).oneTime(),

    other: Markup.keyboard([
        Markup.button('Меню', 'positive')
    ], { columns: 1 }).oneTime(),
      
}

console.log('Вроде стартанул'); //  Вроде, потому что может и не стартануть

bot.on(async (ctx) => {
    if(!ctx.message.text) return; //  На всякий случай
    let text = ctx.message.text;

    usersinfo.findOne({ID: ctx.message.from_id},(err,user)=> {
        if(err) console.log(err);

        //  Далее ситуацию конечно можно назвать говнокодом, но по другому я не знаю, как вообще возможно сделать
        switch (text.toLowerCase()) {
            case "начать": {
                if(!user) {
                    let newUser = new usersinfo({
                        ID: ctx.message.from_id,
                        variant: "",
                        currentQ: "none",
                        orders: []
                    })

                    newUser.save().catch(err => console.log(err));
                }

                ctx.reply('Привет! Это меню! Нажми на кнопку ниже, которая тебя сейчас интересует', null, markups.menu);
    
                break;
            }
    
            case "меню": {
                ctx.reply('Меню', null, markups.menu);
    
                user.currentQ = "none";
                user.save().catch(err => console.log(err))

                break;
            }
    
            case "создать заказ": {
                if(user && user.variant) {
                    ctx.reply(`Использовать ${user.variant} вариант?`, null, markups.yesno);
    
                    user.currentQ = "useYourVariant";
                    user.save().catch(err => console.log(err))
                } else {
                    ctx.reply(`Напишите номер своего варианта`, null, markups.cancelOrder);

                    user.currentQ = "enterYourVariant";
                    user.save().catch(err => console.log(err))
                }
    
                break;
            }

            case "список заказов": {
                let ans = `Список заказов:\n\nНомер, Дата/время, Практическая, Вариант, Статус, Статус оплаты\n`;

                user.orders.forEach( (elm, i) => {
                    ans += `${i+1}. ${elm.date}, ${elm.num}, ${elm.variant}, ${elm.status}, ${elm.payment};\n`
                });

                if(ans == `Список заказов:\n\nНомер, Дата/время, Практическая, Вариант, Статус, Статус оплаты\n`) ans+= 'Заказов ещё не было';

                ctx.reply(ans, null, markups.other);

                break;
            }

            case "посмотреть выполненные": {
                let ans = ``;

                user.orders.filter(elm => elm.status == "Завершено").forEach( (elm, i) => {
                    ans += `${i+1}. ${elm.date}, ${elm.num}, ${elm.variant};\n`
                });

                if(!ans) ans = 'Выполненных заказов ещё нет';

                ctx.reply(`Выбери номер, чтобы посмотреть решение:\n\nНомер, Дата/время, Практическая, Вариант\n` +ans, null, markups.other);

                user.currentQ = "choice";
                user.save().catch(err => console.log(err))

                break;
            }

            case "отмена": {
                ctx.reply('Меню', null, markups.menu);
    
                user.currentQ = "none";
                user.tempOrder = "";
                user.save().catch(err => console.log(err))

                break;
            }
    
            default: {
                if(!user || user.currentQ == "none") ctx.reply(`Ты похоже заблудился. Напиши "меню"`, null, markups.other);

                switch (user.currentQ) {
                    case "useYourVariant": {
                        if(text == 'Да') {
                            user.currentQ = "enterNumberPract";
                            user.tempOrder = {variant: user.variant, num: "", date: `${strftime('%d.%m.%y/%H:%M', new Date())}`, payment: "Ожидание" ,status: "Ожидание", attachment: [] }
                            user.save().catch(err => console.log(err))

                            ctx.reply(`Напишите номер практической работы`, null, markups.cancelOrder);
                        } else if(text == 'Нет') {
                            ctx.reply(`Напишите номер своего варианта`, null, markups.cancelOrder);

                            user.currentQ = "enterYourVariant";
                            user.save().catch(err => console.log(err))
                        }

                        break;
                    }

                    case "enterYourVariant": {
                        user.currentQ = "enterNumberPract";
                        user.variant = text;
                        user.tempOrder = {variant: text, num: "", date: `${strftime('%d.%m.%y/%H:%M', new Date())}`, payment: "Ожидание" ,status: "Ожидание", attachment: [] }
                        user.save().catch(err => console.log(err))

                        ctx.reply(`Напишите номер практической работы`, null, markups.cancelOrder);

                        break;
                    }

                    case "enterNumberPract": {
                        user.currentQ = "none";
                        user.tempOrder.num = text;
                        user.orders.push(user.tempOrder);
                        //user.tempOrder = "";
                        user.save().catch(err => console.log(err));

                        ctx.reply(`Заказ успешно создан!\n\nСпособы оплаты:\nНаличными:\nПринесите деньги в школу\nВиртуальными:\nОтправьте 20 рублей на Qiwi qiwi.com/n/ELECTRO303 или на карту 4890494735412249 с комментарием "${ctx.message.from_id}" или вашим именем.\nОплата подтверждается в течение 24 часов\nПри возникновении проблем отправляйтесь в ЛС.`, null, markups.other);

                        bot.sendMessage(251129652, `Новый заказ!\n\nID: ${ctx.message.from_id}\nВариант: ${user.tempOrder.variant}\nПрактическая: ${user.tempOrder.num}\n\nУдачи!)`, 'photo1_1');

                        break;
                    }

                    case "choice": {
                        if(!/^(0|[1-9]\d*)$/.test(text)) return ctx.reply(`Это не номер!`, null, markups.other);
                        if(!user.orders.filter(elm => elm.status == "Завершено")[text-1]) return ctx.reply(`Этого номера нет!`, null, markups.other);

                        let order = user.orders.filter(elm => elm.status == "Завершено")[text-1];

                        ctx.reply(`Практическая работа №${order.num}\nВариант ${order.variant}\nДата: ${order.date}\nОтветы:\n${order.attachment.join("\n")}`, null, markups.other)

                        break;
                    }
                }
                break;
            }
        }
    });
});

bot.startPolling((err) => {
    if (err) console.error(err);
});