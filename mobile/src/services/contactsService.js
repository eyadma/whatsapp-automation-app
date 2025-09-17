import * as Contacts from 'expo-contacts';

class ContactsService {
  constructor() {
    this.permissionStatus = null;
  }

  async checkPermission() {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      this.permissionStatus = status;
      return status === 'granted';
    } catch (error) {
      console.error('Error checking contacts permission:', error);
      return false;
    }
  }

  async requestPermission() {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      this.permissionStatus = status;
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return false;
    }
  }

  async getContacts() {
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        throw new Error('Contacts permission not granted');
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });

      return data.map(contact => ({
        id: contact.id,
        name: contact.name || 'Unknown',
        phoneNumbers: contact.phoneNumbers || [],
        emails: contact.emails || [],
        displayName: contact.name || 'Unknown Contact',
      }));
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  }

  async searchContacts(query) {
    try {
      const contacts = await this.getContacts();
      const lowercaseQuery = query.toLowerCase();
      
      return contacts.filter(contact => 
        contact.name.toLowerCase().includes(lowercaseQuery) ||
        contact.phoneNumbers.some(phone => 
          phone.number && phone.number.includes(query)
        )
      );
    } catch (error) {
      console.error('Error searching contacts:', error);
      throw error;
    }
  }

  async getContactById(contactId) {
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        throw new Error('Contacts permission not granted');
      }

      const { data } = await Contacts.getContactsAsync({
        id: contactId,
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });

      if (data.length > 0) {
        const contact = data[0];
        return {
          id: contact.id,
          name: contact.name || 'Unknown',
          phoneNumbers: contact.phoneNumbers || [],
          emails: contact.emails || [],
          displayName: contact.name || 'Unknown Contact',
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting contact by ID:', error);
      throw error;
    }
  }

  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle Israeli phone numbers
    if (cleaned.startsWith('972')) {
      return '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('0')) {
      return cleaned;
    } else if (cleaned.length === 9 && cleaned.startsWith('5')) {
      return '0' + cleaned;
    }
    
    return cleaned;
  }

  async getContactsForWhatsApp() {
    try {
      const contacts = await this.getContacts();
      
      return contacts
        .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
        .map(contact => ({
          id: contact.id,
          name: contact.name,
          displayName: contact.displayName,
          phoneNumbers: contact.phoneNumbers.map(phone => ({
            number: phone.number,
            formatted: this.formatPhoneNumber(phone.number),
            type: phone.type || 'mobile',
          })),
          primaryPhone: this.formatPhoneNumber(contact.phoneNumbers[0]?.number),
        }))
        .filter(contact => contact.primaryPhone); // Only include contacts with valid phone numbers
    } catch (error) {
      console.error('Error getting contacts for WhatsApp:', error);
      throw error;
    }
  }

  async syncContactsWithDatabase(apiBaseUrl) {
    try {
      const contacts = await this.getContactsForWhatsApp();
      
      // Send contacts to your backend for syncing
      const response = await fetch(`${apiBaseUrl}/api/contacts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contacts: contacts,
          userId: 'current-user', // You might want to get this from your auth system
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync contacts with database');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error syncing contacts with database:', error);
      throw error;
    }
  }
}

export default new ContactsService();
